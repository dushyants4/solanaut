// Milestone 2a.4, policy v1 (docs/SPEC.md §3 and rule 0). A policy is validated when it is
// created, or no guard exists; it is copied, frozen all the way down, and hashed. Amounts are
// bigint, so nothing is lost above 2^53. Closes defects D1 (a mutable policy), D2 (an unvalidated
// policy: NaN disabled a cap) and D9 (lamports as JS numbers).

import { strict as assert } from "node:assert";
import { test } from "node:test";
import { contextOf, createPolicy, PolicyError, type PolicyInput } from "../src/policy-v1.ts";
import { randomAddress, rng } from "./support/kit.ts";

const r = rng(404);
const addr = () => randomAddress(r) as string;
const AGENT = addr(), OPERATOR = addr(), TREASURY = addr(), USDC = addr(), TABLE = addr(), ENTRY = addr(), TIP = addr();
const SYSTEM = "11111111111111111111111111111111";

const valid = (): PolicyInput => ({
  version: 1,
  principal: [AGENT],
  programs: { allow: [SYSTEM], opaque: "deny" },
  destinations: { allow: [TREASURY] },
  sol: { maxPerTx: 1_000_000_000n, maxPerWindow: 3_000_000_000n },
  tokens: [{ mint: USDC, program: "token", maxPerTx: "5000000", maxPerWindow: "20000000" }],
  fees: { maxPriorityPerTx: 100_000n, maxPerWindow: 1_000_000n, tipAccounts: [TIP] },
  lookupTables: [{ address: TABLE, entries: [ENTRY] }],
  windowMs: 86_400_000,
  intents: { maxAttempts: 3 },
  latch: { afterDenials: 5, releaseKey: OPERATOR, guardId: "agent-1", cluster: "devnet" },
  messages: { allow: false },
  cosign: { allow: false },
  sensor: { expectedPerMinute: 2 },
});

/** A valid policy with one field replaced, by path. */
function withField(path: string, value: unknown): unknown {
  const p: any = valid();
  const keys = path.split(".");
  let o = p;
  for (const k of keys.slice(0, -1)) o = o[k];
  if (value === DELETE) delete o[keys.at(-1)!];
  else o[keys.at(-1)!] = value;
  return p;
}
const DELETE = Symbol("delete");

function invalid(input: unknown, mentions: RegExp, label: string) {
  assert.throws(() => createPolicy(input), (e: unknown) => {
    assert.ok(e instanceof PolicyError, `${label}: expected a PolicyError, got ${(e as Error)?.name}: ${(e as Error)?.message}`);
    assert.equal(e.rule, "invalid-policy");
    assert.match(e.message, mentions, `${label}: ${e.message}`);
    return true;
  }, label);
}

test("a valid policy loads, with amounts as bigint and a 64-hex hash", () => {
  const { policy, hash } = createPolicy(valid());
  assert.equal(policy.sol.maxPerTx, 1_000_000_000n);
  assert.equal(policy.tokens[0]!.maxPerTx, 5_000_000n, "a decimal string becomes a bigint");
  assert.match(hash, /^[0-9a-f]{64}$/);
});

test("the hash depends on content only: key order and amount spelling do not change it; any value does", () => {
  const { hash } = createPolicy(valid());
  const reordered = Object.fromEntries(Object.entries(valid()).reverse());
  assert.equal(createPolicy(reordered).hash, hash, "key order");
  assert.equal(createPolicy(withField("sol.maxPerTx", "1000000000")).hash, hash, "a bigint and its decimal string");
  for (const [path, value] of [
    ["sol.maxPerTx", 1_000_000_001n],
    ["windowMs", 86_400_001],
    ["latch.guardId", "agent-2"],
    ["programs.opaque", "allow"],
    ["principal", [AGENT, TREASURY]],
  ] as const) {
    assert.notEqual(createPolicy(withField(path, value)).hash, hash, path);
  }
});

test("the hash is SHA-256 of canonical JSON: sorted keys, no whitespace, amounts as decimal strings", () => {
  // The expected digest was computed outside this codebase, by Python's
  // json.dumps(policy, sort_keys=True, separators=(",", ":")) over the same policy with amounts as strings.
  const { hash } = createPolicy({
    version: 1,
    principal: ["MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr"],
    programs: { allow: ["11111111111111111111111111111111"], opaque: "deny" },
    destinations: { allow: ["TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"] },
    sol: { maxPerTx: 1_000_000_000n, maxPerWindow: 3_000_000_000n },
    tokens: [{ mint: "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL", program: "token", maxPerTx: 5n, maxPerWindow: 10n }],
    fees: { maxPriorityPerTx: 100_000n, maxPerWindow: 1_000_000n, tipAccounts: ["ComputeBudget111111111111111111111111111111"] },
    lookupTables: [],
    windowMs: 86_400_000,
    intents: { maxAttempts: 3 },
    latch: { afterDenials: 5, releaseKey: "Memo1UhkJRfHyvLMcVucJwxXeuD728EqVDDwQDxFMNo", guardId: "known-answer", cluster: "devnet" },
    messages: { allow: false },
    cosign: { allow: false },
    sensor: { expectedPerMinute: 2 },
  });
  assert.equal(hash, "8df52fd7623cdd1a19226200df07b4003b2f427d295eb2748d0f2b548840caf4");
});

test("D1: the policy is a frozen copy; neither the caller's object nor the returned one can widen it", () => {
  const input: any = valid();
  const { policy, hash } = createPolicy(input);
  input.destinations.allow.push("attacker");
  input.sol.maxPerTx = 10n ** 30n;
  assert.deepEqual(policy.destinations.allow, [TREASURY], "changing the input changes nothing");
  assert.equal(policy.sol.maxPerTx, 1_000_000_000n);
  assert.throws(() => (policy.destinations.allow as string[]).push("attacker"), TypeError);
  assert.throws(() => { (policy.sol as any).maxPerTx = 1n; }, TypeError);
  assert.throws(() => { (policy.lookupTables[0]!.entries as string[])[0] = "attacker"; }, TypeError);
  assert.throws(() => { (policy as any).principal = []; }, TypeError);
  assert.equal(createPolicy(valid()).hash, hash);
});

test("D2: a cap that is not a whole, non-negative amount is refused, never read as no cap", () => {
  for (const bad of [Number.NaN, Infinity, -1, 1.5, 1e9, "1.5", "-1", "01", "", " 1", "1e9", "0x10", null, undefined, true]) {
    invalid(withField("sol.maxPerTx", bad), /sol\.maxPerTx/, `sol.maxPerTx = ${String(bad)}`);
  }
  invalid(withField("fees.maxPerWindow", Number.NaN), /fees\.maxPerWindow/, "fees");
  invalid(withField("tokens", [{ mint: USDC, program: "token", maxPerTx: -5n, maxPerWindow: 1n }]), /tokens\[0\]\.maxPerTx/, "token cap");
  assert.equal(createPolicy(withField("sol.maxPerTx", 0n)).policy.sol.maxPerTx, 0n, "zero is a cap: nothing may move");
});

test("D9: amounts past 2^53 are exact", () => {
  const max = 18_446_744_073_709_551_615n;
  const { policy } = createPolicy(withField("sol.maxPerWindow", max.toString()));
  assert.equal(policy.sol.maxPerWindow, max);
  invalid(withField("sol.maxPerWindow", (max + 1n).toString()), /sol\.maxPerWindow/, "past u64");
});

test("rule 0: addresses must be canonical base58 keys, and the principal must hold one", () => {
  invalid(withField("principal", []), /principal/, "empty principal");
  for (const [path, value] of [
    ["principal", ["not-an-address"]],
    ["principal", [""]],
    ["destinations.allow", [TREASURY, "0OIl"]],
    ["programs.allow", ["x"]],
    ["fees.tipAccounts", ["tip"]],
    ["latch.releaseKey", "operator"],
    ["tokens", [{ mint: "usdc", program: "token", maxPerTx: 1n, maxPerWindow: 1n }]],
    ["lookupTables", [{ address: "table", entries: [] }]],
    ["lookupTables", [{ address: TABLE, entries: [ENTRY, "not-a-key"] }]],
  ] as const) {
    invalid(withField(path, value), new RegExp(path.split(".")[0]!), `${path} = ${JSON.stringify(value, (_k, x) => (typeof x === "bigint" ? `${x}n` : x))}`);
  }
});

test("rule 0: the latch's release key is never a principal key, so the agent cannot release its own latch", () => {
  invalid(withField("latch.releaseKey", AGENT), /releaseKey/, "the agent's key");
});

test("rule 0: one entry per mint and per table, a known token program, and a known cluster", () => {
  invalid(withField("tokens", [valid().tokens[0], valid().tokens[0]]), /tokens/, "a mint twice");
  invalid(withField("lookupTables", [{ address: TABLE, entries: [] }, { address: TABLE, entries: [ENTRY] }]), /lookupTables/, "a table twice");
  invalid(withField("tokens", [{ mint: USDC, program: "token-2023", maxPerTx: 1n, maxPerWindow: 1n }]), /program/, "token program");
  invalid(withField("latch.cluster", "mainnet"), /cluster/, "cluster");
  invalid(withField("programs.opaque", "maybe"), /opaque/, "opaque");
});

test("rule 0: counts and durations are positive whole numbers; the guard id fits on one line", () => {
  for (const [path, bad] of [
    ["windowMs", 0], ["windowMs", -1], ["windowMs", Number.NaN], ["windowMs", 1.5],
    ["intents.maxAttempts", 0], ["latch.afterDenials", 0], ["latch.afterDenials", 2.5],
    ["sensor.expectedPerMinute", 0], ["sensor.expectedPerMinute", Number.NaN],
    ["latch.guardId", ""], ["latch.guardId", "a\nb"], ["latch.guardId", "x".repeat(65)],
  ] as const) {
    invalid(withField(path, bad), new RegExp(path.split(".").at(-1)!), `${path} = ${String(bad)}`);
  }
});

test("rule 0: v1 never signs messages or co-signs, and refuses any field it does not know", () => {
  invalid(withField("messages.allow", true), /messages/, "messages");
  invalid(withField("cosign.allow", true), /cosign/, "cosign");
  invalid(withField("version", 2), /version/, "version");
  invalid({ ...(valid() as object), maxLamportsPerTx: 1 }, /maxLamportsPerTx/, "an unknown field, say a v0 one");
  invalid(withField("sol.maxPertx", 1n), /maxPertx/, "a misspelt field");
  invalid(withField("fees", DELETE), /fees/, "a missing section");
  invalid(null, /policy/, "null");
  invalid("{}", /policy/, "a string");
});

test("every problem is reported at once, so an operator fixes them in one pass", () => {
  const p: any = valid();
  p.principal = [];
  p.windowMs = 0;
  p.sol.maxPerTx = Number.NaN;
  assert.throws(() => createPolicy(p), (e: unknown) => e instanceof PolicyError && e.problems.length === 3);
});

test("the classifier's context comes from the policy", () => {
  const { policy } = createPolicy(valid());
  assert.deepEqual(contextOf(policy), {
    principal: [AGENT],
    destinations: [TREASURY],
    tokens: [{ mint: USDC, program: "token" }],
    tipAccounts: [TIP],
    lookupTables: [{ address: TABLE, entries: [ENTRY] }],
  });
});
