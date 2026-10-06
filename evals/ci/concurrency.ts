import { createGuard } from "../../packages/sdk/src/guard.ts";
import type { PolicyInput } from "../../packages/sdk/src/policy.ts";
import { encodeBase58 } from "../../packages/sdk/src/base58.ts";
import { craftLegacy, enc, key } from "../../packages/sdk/test/support/craft.ts";
import { rng } from "../../packages/sdk/test/support/kit.ts";
export interface AdmissionEvidence { proposed: number; admitted: number; denied: number; recorded: number; destinations: number; identities: number; reserved: string; deniedRules: string[] }
export function validateAdmissions(result: AdmissionEvidence): void {
  if (!Number.isSafeInteger(result.proposed) || result.proposed < 1000) throw new Error("concurrent proposal budget below floor");
  if (result.admitted !== 7 || result.denied + result.admitted !== result.proposed) throw new Error("concurrent admission totals differ");
  if ([result.recorded, result.destinations, result.identities].some((count) => count !== result.proposed)) throw new Error("concurrent evidence incomplete or deduplicated");
  if (result.reserved !== "7000000") throw new Error("concurrent reservation total differs");
  if (result.deniedRules.length !== 1 || result.deniedRules[0] !== "over-window-cap") throw new Error("concurrent refusal rule differs");
}
export async function measureAdmissions(): Promise<AdmissionEvidence> {
  const random = rng(20261006); const destinations = Array.from({ length: 1000 }, () => random.bytes(32));
  const addresses = destinations.map(encodeBase58);
  const policy: PolicyInput = { version: 1, principal: [encodeBase58(Uint8Array.from(key(1)))],
    programs: { allow: [encodeBase58(Uint8Array.from(key(0)))], opaque: "deny" }, destinations: { allow: addresses },
    sol: { maxPerTx: 1_000_000n, maxPerWindow: 7_000_000n }, tokens: [],
    fees: { maxPriorityPerTx: 0n, maxPerWindow: 1_000_000_000n, tipAccounts: [] }, lookupTables: [], windowMs: 60_000,
    intents: { maxAttempts: 3 }, latch: { afterDenials: 10_000, releaseKey: encodeBase58(Uint8Array.from(key(20))), guardId: "concurrent-sdk", cluster: "localnet" },
    messages: { allow: false }, cosign: { allow: false }, sensor: { expectedPerMinute: 6 } };
  const guard = await createGuard({ policy, sensor: () => ({ intensity: 0, valence: 0, repetition: 0 }) });
  let release!: () => void; const barrier = new Promise<void>((resolve) => { release = resolve; });
  try {
    const callers = destinations.map(async (destination, index) => {
      await barrier;
      const message = craftLegacy({ keys: [key(1), [...destination], key(0)], header: [1, 0, 1],
        instructions: [{ program: 2, accounts: [0, 1], data: [...enc.u32(2), ...enc.u64(1_000_000n)] }] });
      return guard.check({ message, at: 1000 }, { clientId: "batch", id: String(index) });
    });
    if (guard.entries().length !== 0) throw new Error("concurrent callers ran before barrier release");
    release(); const results = await Promise.all(callers); const admitted = results.filter((result) => result.allow);
    return { proposed: results.length, admitted: admitted.length, denied: results.length - admitted.length,
      recorded: guard.entries().filter((entry) => entry.kind === "decision").length, destinations: new Set(addresses).size,
      identities: new Set(results.flatMap((result) => result.request ? [result.request.id] : [])).size,
      reserved: admitted.reduce((sum, result) => sum + BigInt(result.amounts!.sol), 0n).toString(),
      deniedRules: [...new Set(results.filter((result) => !result.allow).map((result) => result.rule ?? "missing-rule"))].sort() };
  } finally { guard.close(); }
}
