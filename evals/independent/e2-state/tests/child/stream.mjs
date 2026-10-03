// Child: make its own keys and policy, print the policy, then run a stream of every entry kind
// against a record until killed. After each call returns it prints one "ack" line per new entry,
// then a "st" line with the guard's status. Output goes through fs.writeSync(1), so a line is out
// before the next call starts.
// argv: <log path>
import fs from "node:fs";
import crypto from "node:crypto";
import { createGuard, encodeBase58, decodeBase58 } from "@solanaut/sdk";

function out(s) {
  const b = Buffer.from(s + "\n");
  let off = 0;
  while (off < b.length) {
    try { off += fs.writeSync(1, b, off); } catch (e) { if (e.code !== "EAGAIN") throw e; }
  }
}
function kp() {
  const { publicKey, privateKey } = crypto.generateKeyPairSync("ed25519");
  const raw = new Uint8Array(publicKey.export({ format: "der", type: "spki" }).subarray(-32));
  return { address: encodeBase58(raw), raw, sign: (m) => new Uint8Array(crypto.sign(null, Buffer.from(m), privateKey)) };
}
function cu16(n) { const o = []; let v = n; for (;;) { const b = v & 0x7f; v >>= 7; if (!v) { o.push(b); break; } o.push(b | 0x80); } return o; }
function transfer(from, to, lamports) {
  const keys = [from.raw, decodeBase58(to), new Uint8Array(32)];
  const data = Buffer.alloc(12); data.writeUInt32LE(2, 0); data.writeBigUInt64LE(BigInt(lamports), 4);
  return new Uint8Array([1, 0, 1, ...cu16(3), ...keys.flatMap((k) => [...k]), ...crypto.randomBytes(32),
    ...cu16(1), 2, ...cu16(2), 0, 1, ...cu16(12), ...data]);
}

const agent = kp(), operator = kp(), dest = kp().address, stranger = kp().address;
const policy = {
  version: 1, principal: [agent.address], programs: { allow: ["11111111111111111111111111111111"], opaque: "deny" },
  destinations: { allow: [dest] }, sol: { maxPerTx: "1000000000", maxPerWindow: "1000000000000" }, tokens: [],
  fees: { maxPriorityPerTx: "100000", maxPerWindow: "1000000000000", tipAccounts: [] }, lookupTables: [],
  windowMs: 60000, intents: { maxAttempts: 3 },
  latch: { afterDenials: 4, releaseKey: operator.address, guardId: "eval-stream", cluster: "localnet" },
  messages: { allow: false }, cosign: { allow: false }, sensor: { expectedPerMinute: 1000 },
};
out("policy " + JSON.stringify(policy));
const calm = () => ({ intensity: 0, valence: 0.2, repetition: 0 });
const guard = await createGuard({ policy, sensor: calm, log: process.argv[2] });

let seen = guard.entries().length;
function ack() {
  const es = guard.entries();
  for (; seen < es.length; seen++) out(`ack ${es[seen].seq} ${es[seen].hash} ${es[seen].kind}`);
  out("st " + JSON.stringify(guard.status()));
}

const T0 = 50_000_000;
const outcomes = ["landed", "failed", "unknown", "expired"];
let lastAllowed = null, firstOfCycle = null, firstMsg = null;
for (let i = 0; i < 3000; i++) {
  const at = T0 + i * 10, h = 1000 + i;
  const step = i % 12;
  try {
    if (step <= 2 || step === 11) {
      const msg = transfer(agent, dest, 1000 + i);
      const d = guard.check({ message: msg, at, blockHeight: BigInt(h), lastValidBlockHeight: BigInt(h + 150) });
      if (d.allow) { lastAllowed = d; if (step === 0) { firstOfCycle = d; firstMsg = msg; } }
    } else if (step === 3) {
      if (lastAllowed) guard.report(lastAllowed.hash, outcomes[(i / 12 | 0) % 4]);
    } else if (step === 4) {
      if (firstOfCycle) guard.redeem(firstMsg, firstOfCycle.hash, BigInt(h));
    } else if (step <= 9) {
      guard.check({ message: transfer(agent, stranger, 1 + i), at, blockHeight: BigInt(h), lastValidBlockHeight: BigInt(h + 150) });
    } else if (step === 10) {
      if (guard.status().latched) {
        const text = guard.releaseText(new Date(at + 600_000).toISOString());
        guard.release(text, operator.sign(Buffer.from(text, "utf8")), at);
      }
    }
  } catch (e) {
    out("err " + String(e && e.message).slice(0, 120));
  }
  ack();
}
out("done");
setInterval(() => {}, 1 << 30);
