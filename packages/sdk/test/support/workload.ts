// A deterministic workload for the restart battery: payments, a drain, garbage bytes, outcome
// reports, receipt redemptions and latch releases, one record entry per step. Every step reads
// only the guard's own record and status, so a guard restored from its record mid-run takes
// exactly the steps an uninterrupted one would. Shared by the test and the child process it kills.

import { createPrivateKey, createPublicKey, sign } from "node:crypto";
import { encodeBase58 } from "../../src/base58.ts";
import type { Decision, Guard } from "../../src/guard.ts";
import type { PolicyInput } from "../../src/policy.ts";
import { craftLegacy, key } from "./craft.ts";

// The operator's test key, derived from a fixed seed so the parent and child processes share it.
// It signs latch releases in tests and nothing else.
const SEED = Buffer.alloc(32, 7);
const PKCS8_ED25519 = Buffer.from("302e020100300506032b657004220420", "hex");
const operatorKey = createPrivateKey({ key: Buffer.concat([PKCS8_ED25519, SEED]), format: "der", type: "pkcs8" });
const OPERATOR = encodeBase58(Buffer.from(createPublicKey(operatorKey).export({ format: "jwk" }).x!, "base64url"));

const b58 = (n: number) => encodeBase58(Uint8Array.from(key(n)));
const AGENT = b58(1);
const TREASURY = b58(2);
const ATTACKER = b58(3);
const SYSTEM = "11111111111111111111111111111111";

export const WORKLOAD_POLICY: PolicyInput = {
  version: 1,
  principal: [AGENT],
  programs: { allow: [SYSTEM], opaque: "deny" },
  destinations: { allow: [TREASURY] },
  sol: { maxPerTx: 1_000_000_000n, maxPerWindow: 3_000_000_000n },
  tokens: [],
  fees: { maxPriorityPerTx: 100_000n, maxPerWindow: 50_000_000n, tipAccounts: [] },
  lookupTables: [],
  windowMs: 20_000,
  intents: { maxAttempts: 3 },
  latch: { afterDenials: 3, releaseKey: OPERATOR, guardId: "workload", cluster: "localnet" },
  messages: { allow: false },
  cosign: { allow: false },
  sensor: { expectedPerMinute: 6 },
};

/** A legacy System transfer from the agent, built byte by byte: header, keys, blockhash, one instruction. */
function transfer(to: number, lamports: bigint, seed: number): Uint8Array {
  const data = [2, 0, 0, 0, ...Array.from({ length: 8 }, (_, i) => Number((lamports >> BigInt(8 * i)) & 0xffn))];
  return craftLegacy({ header: [1, 0, 1], keys: [key(1), key(to), key(0)], blockhash: key(100 + (seed % 100)), instructions: [{ program: 2, accounts: [0, 1], data }] });
}

export const TOTAL_STEPS = 160;

/** Take step i. Each step appends exactly one entry to the guard's record. */
export function step(g: Guard, i: number): void {
  const at = 1_000_000 + i * 700;
  const heights = { blockHeight: BigInt(1_000 + i), lastValidBlockHeight: BigInt(1_000 + i + 12) };
  const entries = g.entries();
  const decisions = entries.filter((e): e is Decision => e.kind === "decision");
  const reported = new Set(entries.flatMap((e) => (e.kind === "report" ? [e.decision] : [])));
  const redeemed = new Set(entries.flatMap((e) => (e.kind === "redeem" ? [e.decision] : [])));
  const openAllowed = decisions.filter((d) => d.allow && !reported.has(d.hash));

  const pay = () => g.check({ message: transfer(2, BigInt(1 + ((i * 7_919) % 400)) * 1_000_000n, i), at, ...heights });
  if (g.status().latched && i % 2 === 0) {
    // The operator releases on the next even step: a latching costs a step or two, and is seen denying.
    const text = g.releaseText(new Date(at + 600_000).toISOString());
    const res = g.release(text, new Uint8Array(sign(null, Buffer.from(text, "utf8"), operatorKey)), at);
    if (!res.released) throw new Error(`workload release refused: ${res.reason}`);
    return;
  }
  switch (i % 10) {
    case 6:
      g.check({ message: transfer(3, 5n * 1_000_000n, i), at, ...heights }); // a drain
      return;
    case 7: {
      const d = openAllowed[0];
      if (!d) return void pay();
      g.report(d.hash, (["landed", "failed", "unknown", "expired"] as const)[i % 4]!);
      return;
    }
    case 8:
      if (Math.floor(i / 10) % 2 === 0) return void g.check({ message: Uint8Array.of(i % 256, 1, 2), at }); // garbage
      return void g.check({ message: transfer(2, 900_000_000n + BigInt(i), i), at, ...heights }); // a large payment, against the window
    case 9: {
      const last = decisions.filter((d) => d.allow).at(-1);
      if (last) return void g.check({ message: new Uint8Array(Buffer.from(last.message, "base64")), at, ...heights }); // a re-send of the last admitted bytes
      return void pay();
    }
    case 5: {
      const d = decisions.filter((x) => x.allow && !redeemed.has(x.hash) && x.expires).at(-1);
      if (!d || !g.redeem(new Uint8Array(Buffer.from(d.message, "base64")), d.hash, BigInt(d.expires!.lastValidBlockHeight)).ok) return void pay();
      return;
    }
    default:
      pay();
  }
}

/** Run steps from wherever the guard's record left off, calling `after` once each step is recorded. */
export function runFrom(g: Guard, after: (seq: number) => void = () => {}): void {
  for (let i = g.status().seq; i < TOTAL_STEPS; i++) {
    step(g, i);
    if (g.status().seq !== i + 1) throw new Error(`step ${i} recorded ${g.status().seq - i} entries, not 1`);
    after(i);
  }
}
