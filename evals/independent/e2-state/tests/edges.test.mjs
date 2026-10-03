// Edges of rules 14, 15 and 16 and of the clock.
import { test } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import { createGuard, decodeBase58 } from "@solanaut/sdk";
import { setup, transfer, prop, keypair, calmSensor, SYSTEM } from "./lib/helpers.mjs";

const T0 = 8_000_000;
const CB = "ComputeBudget111111111111111111111111111111";
const TOKEN = "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA";

function cu16(n) { const o = []; let v = n; for (;;) { const b = v & 0x7f; v >>= 7; if (!v) { o.push(b); break; } o.push(b | 0x80); } return o; }

/** Legacy message: SPL Token TransferChecked(amount, decimals) from `source` to `destAcct`, authority = agent (signer, fee payer). */
function transferChecked(agent, source, destAcct, mint, amount, decimals = 6) {
  // keys: agent (signer, writable), source (w), dest (w), mint (ro), token program (ro)
  const keys = [agent.bytes, decodeBase58(source), decodeBase58(destAcct), decodeBase58(mint), decodeBase58(TOKEN)];
  const data = Buffer.alloc(10); data[0] = 12; data.writeBigUInt64LE(BigInt(amount), 1); data[9] = decimals;
  return new Uint8Array([1, 0, 2, ...cu16(5), ...keys.flatMap((k) => [...k]), ...crypto.randomBytes(32),
    ...cu16(1), 4, ...cu16(4), 1, 3, 2, 0, ...cu16(10), ...data]);
}

test("S74 §5 rule 16 for a mint: at the mint's window cap is allowed, one unit over is over-window-cap", async () => {
  const s = setup();
  const mint = keypair().address, source = keypair().address, destAcct = keypair().address;
  const policy = {
    ...s.policy,
    programs: { allow: [SYSTEM, TOKEN], opaque: "deny" },
    destinations: { allow: [s.dest, destAcct] }, // §4: "or an address the policy names directly"
    tokens: [{ mint, program: "token", maxPerTx: 1000n, maxPerWindow: 1000n }],
  };
  const g = await createGuard({ policy, sensor: calmSensor });
  const a = g.check(prop(transferChecked(s.agent, source, destAcct, mint, 600n), T0, 100, 250));
  assert.equal(a.allow, true, `precondition: ${a.rule}: ${a.reason}`);
  const over = g.check(prop(transferChecked(s.agent, source, destAcct, mint, 401n), T0 + 1, 100, 250));
  assert.equal(over.rule, "over-window-cap");
  const at = g.check(prop(transferChecked(s.agent, source, destAcct, mint, 400n), T0 + 2, 100, 250));
  assert.equal(at.allow, true, `600 + 400 = 1000: ${at.rule}: ${at.reason}`);
});

test("S75 §5 rule 15 / §7 Intents: a denied proposal is not an attempt; only admitted attempts count toward maxAttempts", async () => {
  const s = setup({ intents: { maxAttempts: 2 }, programs: { allow: [SYSTEM, CB] }, fees: { maxPriorityPerTx: 1000n } });
  const g = await createGuard({ policy: s.policy, sensor: calmSensor });
  const a1 = g.check(prop(transfer(s.agent, s.dest, 1000n), T0, 100, 250));
  assert.equal(a1.allow, true);
  g.report(a1.hash, "failed");
  // the same effects with a 2000-lamport priority fee: over-fee-cap (rule 13), never admitted
  const pricey = g.check(prop(transfer(s.agent, s.dest, 1000n, { microLamports: 10_000, units: 200_000 }), T0 + 1, 101, 251));
  assert.equal(pricey.rule, "over-fee-cap");
  assert.equal(pricey.intentKey, a1.intentKey, "fees are outside the intent key");
  const a2 = g.check(prop(transfer(s.agent, s.dest, 1000n), T0 + 2, 102, 252));
  assert.equal(a2.allow, true, `attempt 2 of 2: ${a2.rule}: ${a2.reason}`);
});

test("S76 §7 / §5 rule 1: a non-finite 'at' cannot move the latest recorded time and empty the windows", async () => {
  const s = setup({ sol: { maxPerTx: 1000n, maxPerWindow: 1000n } });
  const d2 = keypair().address;
  const policy = { ...s.policy, destinations: { allow: [s.dest, d2] } };
  const g = await createGuard({ policy, sensor: calmSensor });
  const a = g.check(prop(transfer(s.agent, s.dest, 1000n), T0, 100, 250));
  g.report(a.hash, "landed");
  for (const bad of [NaN, Infinity]) {
    const x = g.check(prop(transfer(s.agent, d2, 1n), bad, 100, 250));
    assert.equal(x.allow, false, `at=${bad} must not be admitted`);
    const b = g.check(prop(transfer(s.agent, d2, 1000n), T0 + 1, 100, 250));
    assert.equal(b.rule, "over-window-cap", `after at=${bad}, the window still holds A`);
  }
});

test("S77 §10 D14 rule / §7 'When an intent ends': the hold is counted from the intent's FIRST attempt", async () => {
  const s = setup({ intents: { maxAttempts: 3 } });
  const g = await createGuard({ policy: s.policy, sensor: calmSensor });
  const w = s.policy.windowMs;
  const a1 = g.check(prop(transfer(s.agent, s.dest, 1000n), T0, 100, 250));
  g.report(a1.hash, "failed");
  const a2 = g.check(prop(transfer(s.agent, s.dest, 1000n), T0 + 50_000, 200, 350)); // unreported
  assert.equal(a2.allow, true);
  // a window after the FIRST attempt, A2 past its last valid height: the intent has ended
  const a3 = g.check(prop(transfer(s.agent, s.dest, 1000n), T0 + w + 1, 400, 550));
  console.log(`S77 observed: allow=${a3.allow} rule=${a3.rule ?? ""}`);
  assert.equal(a3.allow, true, `${a3.rule}: ${a3.reason}`);
});
