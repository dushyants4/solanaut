// §5 rule 0, invalid-policy: "at creation: a non-finite or negative cap, an empty or invalid address, an empty
// principal, a release key that is the fee payer or in the principal, a pinned table with an invalid entry.
// Creation throws; no guard exists." §11 fail-closed battery: "an invalid policy".
import { test } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import bs58 from "bs58";
import { createGuard, createPolicy, PolicyError } from "@solanaut/sdk";
import { cast, basePolicy } from "./lib.mjs";

const c = await cast();
const isInvalidPolicy = (e) => e instanceof PolicyError && e.rule === "invalid-policy";

async function rejects(edit) {
  const p = basePolicy(c, edit);
  assert.throws(() => createPolicy(p), isInvalidPolicy);
  await assert.rejects(createGuard({ policy: p }), isInvalidPolicy);
}

test("P00 precondition: the base policy is valid and creates a guard", async () => {
  createPolicy(basePolicy(c));
  (await createGuard({ policy: basePolicy(c) })).close();
});

test("P01 a NaN cap (sol.maxPerTx) is invalid-policy and no guard exists", async () => {
  await rejects((p) => { p.sol.maxPerTx = NaN; });
});

test("P02 a non-finite cap given as the string \"Infinity\" (fees.maxPerWindow) is invalid-policy", async () => {
  await rejects((p) => { p.fees.maxPerWindow = "Infinity"; });
});

test("P03 a negative cap (a token's maxPerTx = -1n) is invalid-policy", async () => {
  await rejects((p) => { p.tokens[0].maxPerTx = -1n; });
});

test("P04 a negative cap given as a decimal string (fees.maxPriorityPerTx = \"-5\") is invalid-policy", async () => {
  await rejects((p) => { p.fees.maxPriorityPerTx = "-5"; });
});

test("P05 an empty address in destinations.allow is invalid-policy", async () => {
  await rejects((p) => { p.destinations.allow.push(""); });
});

test("P06 an invalid address (base58 of 31 bytes) in the principal is invalid-policy", async () => {
  await rejects((p) => { p.principal.push(bs58.encode(crypto.randomBytes(31))); });
});

test("P07 an invalid address (not base58: contains '0') in tipAccounts is invalid-policy", async () => {
  await rejects((p) => { p.fees.tipAccounts.push("0" + c.T.slice(1)); });
});

test("P08 an empty principal is invalid-policy", async () => {
  await rejects((p) => { p.principal = []; });
});

test("P09 a release key that is in the principal is invalid-policy", async () => {
  await rejects((p) => { p.latch.releaseKey = c.K2; });
});

test("P10 a pinned lookup table with an invalid entry is invalid-policy", async () => {
  await rejects((p) => { p.lookupTables = [{ address: c.LT, entries: [c.B, "not-an-address"] }]; });
});

test("P11 a pinned lookup table whose own address is invalid is invalid-policy", async () => {
  await rejects((p) => { p.lookupTables = [{ address: bs58.encode(crypto.randomBytes(33)), entries: [c.B] }]; });
});
