// CI-2/rules 12 and 14: domains frozen in evals/ci/caps.md, oracle is bigint arithmetic.
import { strict as assert } from "node:assert";
import { test } from "node:test";
import * as fc from "fast-check";
import { checkAsyncProperty } from "../../../evals/ci/properties.ts";
import { createGuard } from "../src/guard.ts";
import { encodeBase58 } from "../src/base58.ts";
import type { PolicyInput } from "../src/policy.ts";
import { craftLegacy, enc, key } from "./support/craft.ts";
const U64 = 2n ** 64n - 1n;
const address = (n: number) => encodeBase58(Uint8Array.from(key(n)));
function policy(tx: bigint, window: bigint): PolicyInput {
  return { version: 1, principal: [address(1)], programs: { allow: [address(0)], opaque: "deny" },
    destinations: { allow: Array.from({ length: 8 }, (_, i) => address(i + 2)) }, sol: { maxPerTx: tx, maxPerWindow: window },
    tokens: [], fees: { maxPriorityPerTx: 0n, maxPerWindow: 1_000_000n, tipAccounts: [] }, lookupTables: [], windowMs: 60_000,
    intents: { maxAttempts: 3 }, latch: { afterDenials: 100, releaseKey: address(20), guardId: "cap-property", cluster: "localnet" },
    messages: { allow: false }, cosign: { allow: false }, sensor: { expectedPerMinute: 6 } };
}
const transfer = (amount: bigint, destination = 2) => craftLegacy({ keys: [key(1), key(destination), key(0)], header: [1, 0, 1],
  instructions: [{ program: 2, accounts: [0, 1], data: [...enc.u32(2), ...enc.u64(amount)] }] });
const quiet = () => ({ intensity: 0, valence: 0, repetition: 0 });
test("CI-2 SOL per-tx property: full u64 and adjacent boundaries admit exactly within cap", async () => {
  await checkAsyncProperty("sol-per-tx", fc.asyncProperty(fc.bigInt({ min: 0n, max: U64 }), fc.bigInt({ min: 0n, max: U64 }), fc.constantFrom(-1n, 0n, 1n), fc.boolean(), async (cap, arbitrary, delta, boundary) => {
    const adjacent = cap + delta; const amount = boundary ? (adjacent < 0n ? 0n : adjacent > U64 ? U64 : adjacent) : arbitrary;
    const guard = await createGuard({ policy: policy(cap, U64), sensor: quiet });
    try {
      const result = guard.check({ message: transfer(amount), at: 1000 });
      assert.equal(result.allow, amount <= cap, result.reason);
      if (!result.allow) assert.equal(result.rule, "over-per-tx-cap");
    } finally { guard.close(); }
  }));
});
test("CI-2 SOL window property: pending admissions match independent reservation sum", async () => {
  await checkAsyncProperty("sol-window", fc.asyncProperty(fc.bigInt({ min: 0n, max: 8_000_000n }), fc.array(fc.bigInt({ min: 0n, max: 1_000_000n }), { minLength: 1, maxLength: 8 }), async (cap, amounts) => {
    const guard = await createGuard({ policy: policy(1_000_000n, cap), sensor: quiet }); let reserved = 0n;
    try {
      for (const [index, amount] of amounts.entries()) {
        const expected = reserved + amount <= cap;
        const result = guard.check({ message: transfer(amount, index + 2), at: 1000 + index });
        assert.equal(result.allow, expected, result.reason);
        if (result.allow) reserved += amount; else assert.equal(result.rule, "over-window-cap");
        assert.ok(reserved <= cap);
      }
    } finally { guard.close(); }
  }));
});
