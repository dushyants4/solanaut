// Policy v1 (docs/SPEC.md §3): what an agent may sign, written by the operator, and never
// changed by the model. It is checked once, when it is created (rule 0): a policy with any
// problem throws, so no guard exists to run on it. A valid policy is copied field by field,
// frozen all the way down, and hashed; the hash goes into every decision.
//
// Amounts are bigint, or a decimal string of one, and never a JS number: a number loses
// precision above 2^53 (defect D9) and NaN compared with anything is false (defect D2).

import { isAddress } from "./base58.ts";
import { canonicalJSON, sha256hex } from "./canonical.ts";
import type { ClassifyContext } from "./classify.ts";

export class PolicyError extends Error {
  readonly rule = "invalid-policy" as const;
  readonly problems: string[];
  constructor(problems: string[]) {
    super(`invalid policy: ${problems.join("; ")}`);
    this.name = "PolicyError";
    this.problems = problems;
  }
}

export type Cluster = "localnet" | "devnet" | "mainnet-beta";
export type TokenProgram = "token" | "token-2022";

export interface PolicyV1 {
  version: 1;
  /** Omitted remains class-only without changing legacy canonical policy bytes. */
  disclosure?: "class" | "full";
  /** The guarded keys: their outflows are what the policy checks. */
  principal: string[];
  /** `opaque`: whether allowlisted programs the guard does not decode may run at all. */
  programs: { allow: string[]; opaque: "deny" | "allow" };
  /** Owners that may receive SOL or tokens. */
  destinations: { allow: string[] };
  sol: { maxPerTx: bigint; maxPerWindow: bigint };
  /** Any mint not listed is denied. */
  tokens: { mint: string; program: TokenProgram; maxPerTx: bigint; maxPerWindow: bigint }[];
  /** Lamports. The window counts priority fees, base fees and tips. */
  fees: { maxPriorityPerTx: bigint; maxPerWindow: bigint; tipAccounts: string[] };
  /** Pinned prefixes; an index at or past `entries.length` is denied. */
  lookupTables: { address: string; entries: string[] }[];
  windowMs: number;
  intents: { maxAttempts: number };
  latch: { afterDenials: number; releaseKey: string; guardId: string; cluster: Cluster };
  messages: { allow: false };
  cosign: { allow: false };
  sensor: { expectedPerMinute: number };
}

type Amount = bigint | string;

/** What a caller may pass: amounts as bigint or a decimal string, as JSON would carry them. */
export interface PolicyInput extends Omit<PolicyV1, "sol" | "tokens" | "fees"> {
  sol: { maxPerTx: Amount; maxPerWindow: Amount };
  tokens: { mint: string; program: TokenProgram; maxPerTx: Amount; maxPerWindow: Amount }[];
  fees: { maxPriorityPerTx: Amount; maxPerWindow: Amount; tipAccounts: string[] };
}

export type DeepReadonly<T> = T extends bigint | string | number | boolean
  ? T
  : { readonly [K in keyof T]: DeepReadonly<T[K]> };
export type Policy = DeepReadonly<PolicyV1>;

const U64_MAX = 2n ** 64n - 1n;
const CLUSTERS: readonly Cluster[] = ["localnet", "devnet", "mainnet-beta"];

/** Validate, copy, freeze and hash. Throws a PolicyError listing every problem found. */
export function createPolicy(input: unknown): { policy: Policy; hash: string } {
  const problems: string[] = [];
  const check = new Validator(problems);
  const fields = check.object(
    input,
    "policy",
    [
      "version",
      "disclosure",
      "principal",
      "programs",
      "destinations",
      "sol",
      "tokens",
      "fees",
      "lookupTables",
      "windowMs",
      "intents",
      "latch",
      "messages",
      "cosign",
      "sensor",
    ],
    ["disclosure"],
  );
  if (!fields) throw new PolicyError(problems);

  if (fields.version !== 1) problems.push(`version must be 1, not ${describe(fields.version)}`);
  const principal = check.addresses(fields.principal, "principal");
  if (principal && principal.length === 0) problems.push("principal must name at least one key");

  const programs = check.object(fields.programs, "programs", ["allow", "opaque"]);
  const programsAllow = programs && check.addresses(programs.allow, "programs.allow");
  if (programs && programs.opaque !== "deny" && programs.opaque !== "allow")
    problems.push(`programs.opaque must be "deny" or "allow", not ${describe(programs.opaque)}`);

  const destinations = check.object(fields.destinations, "destinations", ["allow"]);
  const destinationsAllow = destinations && check.addresses(destinations.allow, "destinations.allow");

  const sol = check.object(fields.sol, "sol", ["maxPerTx", "maxPerWindow"]);
  const solCaps = sol && {
    maxPerTx: check.amount(sol.maxPerTx, "sol.maxPerTx"),
    maxPerWindow: check.amount(sol.maxPerWindow, "sol.maxPerWindow"),
  };

  const tokens = check.list(fields.tokens, "tokens", (item, path) => {
    const token = check.object(item, path, ["mint", "program", "maxPerTx", "maxPerWindow"]);
    if (!token) return undefined;
    const mint = check.address(token.mint, `${path}.mint`);
    if (token.program !== "token" && token.program !== "token-2022")
      problems.push(`${path}.program must be "token" or "token-2022", not ${describe(token.program)}`);
    return {
      mint,
      program: token.program as TokenProgram,
      maxPerTx: check.amount(token.maxPerTx, `${path}.maxPerTx`),
      maxPerWindow: check.amount(token.maxPerWindow, `${path}.maxPerWindow`),
    };
  });
  check.unique(
    tokens?.map((token) => token?.mint),
    "tokens",
    "mint",
  );

  const fees = check.object(fields.fees, "fees", ["maxPriorityPerTx", "maxPerWindow", "tipAccounts"]);
  const feeCaps = fees && {
    maxPriorityPerTx: check.amount(fees.maxPriorityPerTx, "fees.maxPriorityPerTx"),
    maxPerWindow: check.amount(fees.maxPerWindow, "fees.maxPerWindow"),
    tipAccounts: check.addresses(fees.tipAccounts, "fees.tipAccounts"),
  };

  const tables = check.list(fields.lookupTables, "lookupTables", (item, path) => {
    const table = check.object(item, path, ["address", "entries"]);
    return table
      ? {
          address: check.address(table.address, `${path}.address`),
          entries: check.addresses(table.entries, `${path}.entries`),
        }
      : undefined;
  });
  check.unique(
    tables?.map((table) => table?.address),
    "lookupTables",
    "address",
  );

  const windowMs = check.count(fields.windowMs, "windowMs");
  const intents = check.object(fields.intents, "intents", ["maxAttempts"]);
  const maxAttempts = intents && check.count(intents.maxAttempts, "intents.maxAttempts");

  const latch = check.object(fields.latch, "latch", ["afterDenials", "releaseKey", "guardId", "cluster"]);
  let latchCopy;
  if (latch) {
    const releaseKey = check.address(latch.releaseKey, "latch.releaseKey");
    if (releaseKey && principal?.includes(releaseKey))
      problems.push("latch.releaseKey is a principal key: the agent could release its own latch");
    if (typeof latch.guardId !== "string" || !/^[\x20-\x7e]{1,64}$/.test(latch.guardId)) {
      problems.push(
        `latch.guardId must be 1 to 64 printable ASCII characters on one line, not ${describe(latch.guardId)}`,
      );
    }
    if (!CLUSTERS.includes(latch.cluster as Cluster))
      problems.push(`latch.cluster must be one of ${CLUSTERS.join(", ")}, not ${describe(latch.cluster)}`);
    latchCopy = {
      afterDenials: check.count(latch.afterDenials, "latch.afterDenials"),
      releaseKey,
      guardId: latch.guardId,
      cluster: latch.cluster,
    };
  }

  for (const name of ["messages", "cosign"] as const) {
    const section = check.object(fields[name], name, ["allow"]);
    if (section && section.allow !== false) problems.push(`${name}.allow must be false in policy v1`);
  }
  const sensor = check.object(fields.sensor, "sensor", ["expectedPerMinute"]);
  if (
    sensor &&
    !(
      typeof sensor.expectedPerMinute === "number" &&
      Number.isFinite(sensor.expectedPerMinute) &&
      sensor.expectedPerMinute > 0
    )
  ) {
    problems.push(`sensor.expectedPerMinute must be a positive number, not ${describe(sensor.expectedPerMinute)}`);
  }

  const disclosure = fields.disclosure;
  if (disclosure !== undefined && disclosure !== "class" && disclosure !== "full")
    problems.push('disclosure must be "class" or "full"');
  if (problems.length) throw new PolicyError(problems);

  // Every field below was checked above; build the copy from known fields only.
  const policy: PolicyV1 = {
    version: 1,
    ...(disclosure === undefined ? {} : { disclosure: disclosure as "class" | "full" }),
    principal: principal!,
    programs: { allow: programsAllow!, opaque: programs!.opaque as "deny" | "allow" },
    destinations: { allow: destinationsAllow! },
    sol: solCaps as PolicyV1["sol"],
    tokens: tokens as PolicyV1["tokens"],
    fees: feeCaps as PolicyV1["fees"],
    lookupTables: tables as PolicyV1["lookupTables"],
    windowMs: windowMs!,
    intents: { maxAttempts: maxAttempts! },
    latch: latchCopy as PolicyV1["latch"],
    messages: { allow: false },
    cosign: { allow: false },
    sensor: { expectedPerMinute: sensor!.expectedPerMinute as number },
  };
  return { policy: deepFreeze(policy), hash: policyHash(policy) };
}

/** sha256(canonical JSON of the policy), hex. */
export const policyHash = (policy: Policy | PolicyV1): string => sha256hex(canonicalJSON(policy));

/** The parts of the policy the classifier reads. */
export function contextOf(policy: Policy): ClassifyContext {
  return {
    principal: policy.principal,
    destinations: policy.destinations.allow,
    tokens: policy.tokens.map((token) => ({ mint: token.mint, program: token.program })),
    tipAccounts: policy.fees.tipAccounts,
    lookupTables: policy.lookupTables.map((table) => ({ address: table.address, entries: table.entries })),
  };
}

/** A value as a problem quotes it: strings in quotes, bigints with their n. */
function describe(value: unknown) {
  if (typeof value === "string") return JSON.stringify(value);
  if (typeof value === "bigint") return `${value}n`;
  return String(value);
}

function deepFreeze<T>(value: T): DeepReadonly<T> {
  if (value && typeof value === "object") {
    for (const child of Object.values(value)) deepFreeze(child);
    Object.freeze(value);
  }
  return value as DeepReadonly<T>;
}

/** Checks one field at a time, and writes down every problem rather than stopping at the first. */
class Validator {
  readonly #problems: string[];
  constructor(problems: string[]) {
    this.#problems = problems;
  }

  /** A plain object with exactly these keys: a missing key, or one it does not know, is a problem. */
  object(
    value: unknown,
    path: string,
    keys: string[],
    optional: readonly string[] = [],
  ): Record<string, unknown> | undefined {
    if (value === null || typeof value !== "object" || Array.isArray(value)) {
      this.#problems.push(`${path} must be an object, not ${describe(value)}`);
      return undefined;
    }
    const fields = value as Record<string, unknown>;
    const named = (key: string) => (path === "policy" ? key : `${path}.${key}`);
    for (const key of Object.keys(fields))
      if (!keys.includes(key)) this.#problems.push(`${named(key)} is not a policy v1 field`);
    for (const key of keys)
      if (!optional.includes(key) && !(key in fields)) this.#problems.push(`${named(key)} is missing`);
    return fields;
  }

  list<T>(
    value: unknown,
    path: string,
    each: (item: unknown, path: string) => T | undefined,
  ): (T | undefined)[] | undefined {
    if (!Array.isArray(value)) {
      this.#problems.push(`${path} must be a list, not ${describe(value)}`);
      return undefined;
    }
    return value.map((item, i) => each(item, `${path}[${i}]`));
  }

  address(value: unknown, path: string): string | undefined {
    if (typeof value === "string" && isAddress(value)) return value;
    this.#problems.push(`${path} must be a base58 address of 32 bytes, not ${describe(value)}`);
    return undefined;
  }

  addresses(value: unknown, path: string): string[] | undefined {
    const addresses = this.list(value, path, (item, itemPath) => this.address(item, itemPath));
    return addresses?.every((address) => address !== undefined) ? (addresses as string[]) : undefined;
  }

  amount(value: unknown, path: string): bigint | undefined {
    let amount: bigint | undefined;
    if (typeof value === "bigint") amount = value;
    else if (typeof value === "string" && /^(0|[1-9][0-9]*)$/.test(value)) amount = BigInt(value);
    if (amount === undefined || amount < 0n || amount > U64_MAX) {
      this.#problems.push(
        `${path} must be a whole number from 0 to 2^64-1, as a bigint or a decimal string, not ${describe(value)}`,
      );
      return undefined;
    }
    return amount;
  }

  count(value: unknown, path: string): number | undefined {
    if (typeof value === "number" && Number.isSafeInteger(value) && value > 0) return value;
    this.#problems.push(`${path} must be a whole number above 0, not ${describe(value)}`);
    return undefined;
  }

  unique(values: (string | undefined)[] | undefined, path: string, field: string): void {
    const seen = new Set<string>();
    for (const value of values ?? []) {
      if (value === undefined) continue;
      if (seen.has(value)) this.#problems.push(`${path} lists ${field} ${value} twice`);
      seen.add(value);
    }
  }
}
