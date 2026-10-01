// Policy v1 (docs/SPEC.md §3): what an agent may sign, written by the operator, never seen or
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

export type DeepReadonly<T> = T extends bigint | string | number | boolean ? T : { readonly [K in keyof T]: DeepReadonly<T[K]> };
export type Policy = DeepReadonly<PolicyV1>;

const U64_MAX = 2n ** 64n - 1n;
const CLUSTERS: readonly Cluster[] = ["localnet", "devnet", "mainnet-beta"];
const describe = (v: unknown) => (typeof v === "string" ? JSON.stringify(v) : typeof v === "bigint" ? `${v}n` : String(v));

/** Validate, copy, freeze and hash. Throws a PolicyError listing every problem found. */
export function createPolicy(input: unknown): { policy: Policy; hash: string } {
  const problems: string[] = [];
  const v = new Validator(problems);
  const p = v.object(input, "policy", [
    "version", "principal", "programs", "destinations", "sol", "tokens", "fees", "lookupTables", "windowMs", "intents",
    "latch", "messages", "cosign", "sensor",
  ]);
  if (!p) throw new PolicyError(problems);

  if (p.version !== 1) problems.push(`version must be 1, not ${describe(p.version)}`);
  const principal = v.addresses(p.principal, "principal");
  if (principal && principal.length === 0) problems.push("principal must name at least one key");

  const programs = v.object(p.programs, "programs", ["allow", "opaque"]);
  const programsAllow = programs && v.addresses(programs.allow, "programs.allow");
  if (programs && programs.opaque !== "deny" && programs.opaque !== "allow") problems.push(`programs.opaque must be "deny" or "allow", not ${describe(programs.opaque)}`);

  const destinations = v.object(p.destinations, "destinations", ["allow"]);
  const destinationsAllow = destinations && v.addresses(destinations.allow, "destinations.allow");

  const sol = v.object(p.sol, "sol", ["maxPerTx", "maxPerWindow"]);
  const solCaps = sol && { maxPerTx: v.amount(sol.maxPerTx, "sol.maxPerTx"), maxPerWindow: v.amount(sol.maxPerWindow, "sol.maxPerWindow") };

  const tokens = v.list(p.tokens, "tokens", (t, path) => {
    const o = v.object(t, path, ["mint", "program", "maxPerTx", "maxPerWindow"]);
    if (!o) return undefined;
    const mint = v.address(o.mint, `${path}.mint`);
    if (o.program !== "token" && o.program !== "token-2022") problems.push(`${path}.program must be "token" or "token-2022", not ${describe(o.program)}`);
    return { mint, program: o.program as TokenProgram, maxPerTx: v.amount(o.maxPerTx, `${path}.maxPerTx`), maxPerWindow: v.amount(o.maxPerWindow, `${path}.maxPerWindow`) };
  });
  v.unique(tokens?.map((t) => t?.mint), "tokens", "mint");

  const fees = v.object(p.fees, "fees", ["maxPriorityPerTx", "maxPerWindow", "tipAccounts"]);
  const feeCaps = fees && {
    maxPriorityPerTx: v.amount(fees.maxPriorityPerTx, "fees.maxPriorityPerTx"),
    maxPerWindow: v.amount(fees.maxPerWindow, "fees.maxPerWindow"),
    tipAccounts: v.addresses(fees.tipAccounts, "fees.tipAccounts"),
  };

  const tables = v.list(p.lookupTables, "lookupTables", (t, path) => {
    const o = v.object(t, path, ["address", "entries"]);
    return o ? { address: v.address(o.address, `${path}.address`), entries: v.addresses(o.entries, `${path}.entries`) } : undefined;
  });
  v.unique(tables?.map((t) => t?.address), "lookupTables", "address");

  const windowMs = v.count(p.windowMs, "windowMs");
  const intents = v.object(p.intents, "intents", ["maxAttempts"]);
  const maxAttempts = intents && v.count(intents.maxAttempts, "intents.maxAttempts");

  const latch = v.object(p.latch, "latch", ["afterDenials", "releaseKey", "guardId", "cluster"]);
  let latchOut;
  if (latch) {
    const releaseKey = v.address(latch.releaseKey, "latch.releaseKey");
    if (releaseKey && principal?.includes(releaseKey)) problems.push("latch.releaseKey is a principal key: the agent could release its own latch");
    if (typeof latch.guardId !== "string" || !/^[\x20-\x7e]{1,64}$/.test(latch.guardId)) {
      problems.push(`latch.guardId must be 1 to 64 printable ASCII characters on one line, not ${describe(latch.guardId)}`);
    }
    if (!CLUSTERS.includes(latch.cluster as Cluster)) problems.push(`latch.cluster must be one of ${CLUSTERS.join(", ")}, not ${describe(latch.cluster)}`);
    latchOut = { afterDenials: v.count(latch.afterDenials, "latch.afterDenials"), releaseKey, guardId: latch.guardId, cluster: latch.cluster };
  }

  for (const k of ["messages", "cosign"] as const) {
    const o = v.object(p[k], k, ["allow"]);
    if (o && o.allow !== false) problems.push(`${k}.allow must be false in policy v1`);
  }
  const sensor = v.object(p.sensor, "sensor", ["expectedPerMinute"]);
  if (sensor && !(typeof sensor.expectedPerMinute === "number" && Number.isFinite(sensor.expectedPerMinute) && sensor.expectedPerMinute > 0)) {
    problems.push(`sensor.expectedPerMinute must be a positive number, not ${describe(sensor.expectedPerMinute)}`);
  }

  if (problems.length) throw new PolicyError(problems);

  // Every field below was checked above; build the copy from known fields only.
  const policy: PolicyV1 = {
    version: 1,
    principal: principal!,
    programs: { allow: programsAllow!, opaque: programs!.opaque as "deny" | "allow" },
    destinations: { allow: destinationsAllow! },
    sol: solCaps as PolicyV1["sol"],
    tokens: tokens as PolicyV1["tokens"],
    fees: feeCaps as PolicyV1["fees"],
    lookupTables: tables as PolicyV1["lookupTables"],
    windowMs: windowMs!,
    intents: { maxAttempts: maxAttempts! },
    latch: latchOut as PolicyV1["latch"],
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
    tokens: policy.tokens.map((t) => ({ mint: t.mint, program: t.program })),
    tipAccounts: policy.fees.tipAccounts,
    lookupTables: policy.lookupTables.map((t) => ({ address: t.address, entries: t.entries })),
  };
}

function deepFreeze<T>(o: T): DeepReadonly<T> {
  if (o && typeof o === "object") {
    for (const v of Object.values(o)) deepFreeze(v);
    Object.freeze(o);
  }
  return o as DeepReadonly<T>;
}

class Validator {
  readonly #problems: string[];
  constructor(problems: string[]) {
    this.#problems = problems;
  }

  /** A plain object with exactly these keys: a missing key, or one it does not know, is a problem. */
  object(v: unknown, path: string, keys: string[]): Record<string, unknown> | undefined {
    if (v === null || typeof v !== "object" || Array.isArray(v)) {
      this.#problems.push(`${path} must be an object, not ${describe(v)}`);
      return undefined;
    }
    const o = v as Record<string, unknown>;
    for (const k of Object.keys(o)) if (!keys.includes(k)) this.#problems.push(`${path === "policy" ? k : `${path}.${k}`} is not a policy v1 field`);
    for (const k of keys) if (!(k in o)) this.#problems.push(`${path === "policy" ? k : `${path}.${k}`} is missing`);
    return o;
  }

  list<T>(v: unknown, path: string, each: (item: unknown, path: string) => T | undefined): (T | undefined)[] | undefined {
    if (!Array.isArray(v)) {
      this.#problems.push(`${path} must be a list, not ${describe(v)}`);
      return undefined;
    }
    return v.map((item, i) => each(item, `${path}[${i}]`));
  }

  address(v: unknown, path: string): string | undefined {
    if (typeof v === "string" && isAddress(v)) return v;
    this.#problems.push(`${path} must be a base58 address of 32 bytes, not ${describe(v)}`);
    return undefined;
  }

  addresses(v: unknown, path: string): string[] | undefined {
    const out = this.list(v, path, (a, p) => this.address(a, p));
    return out?.every((a) => a !== undefined) ? (out as string[]) : undefined;
  }

  amount(v: unknown, path: string): bigint | undefined {
    let n: bigint | undefined;
    if (typeof v === "bigint") n = v;
    else if (typeof v === "string" && /^(0|[1-9][0-9]*)$/.test(v)) n = BigInt(v);
    if (n === undefined || n < 0n || n > U64_MAX) {
      this.#problems.push(`${path} must be a whole number from 0 to 2^64-1, as a bigint or a decimal string, not ${describe(v)}`);
      return undefined;
    }
    return n;
  }

  count(v: unknown, path: string): number | undefined {
    if (typeof v === "number" && Number.isSafeInteger(v) && v > 0) return v;
    this.#problems.push(`${path} must be a whole number above 0, not ${describe(v)}`);
    return undefined;
  }

  unique(values: (string | undefined)[] | undefined, path: string, field: string): void {
    const seen = new Set<string>();
    for (const x of values ?? []) {
      if (x === undefined) continue;
      if (seen.has(x)) this.#problems.push(`${path} lists ${field} ${x} twice`);
      seen.add(x);
    }
  }
}
