// Definition frozen before measurement. No adaptive timing or weakened completion checks.
export const NATIVE_KILL_SEED = 20261013;
export const NATIVE_KILL_STAGES = Object.freeze([
  "before-decision-write", "before-decision-sync", "after-decision-sync",
  "after-redeem-sync", "after-sign", "before-signed-sync", "after-signed-sync",
  "before-send-started-sync", "after-send-started-sync", "after-response-sync",
  "before-report-sync", "after-report-sync",
]);
export function nativeKillPlan(): string[] {
  let seed = NATIVE_KILL_SEED;
  const plan = [...NATIVE_KILL_STAGES];
  while (plan.length < 100) { seed ^= seed << 13; seed ^= seed >>> 17; seed ^= seed << 5; plan.push(NATIVE_KILL_STAGES[(seed >>> 0) % NATIVE_KILL_STAGES.length]!); }
  return plan;
}
export interface NativeKillRow { index: number; stage: string; signal: string | null; admissions: number; signatures: number; sendStarts: number; sends: number; replayed: boolean; decisions: number; replayDecisions: number; reservation: boolean }
export function requireNativeKills(rows: readonly NativeKillRow[]): void {
  const plan = nativeKillPlan();
  if (rows.length !== plan.length) throw new Error("incomplete native kill population");
  for (const [index, row] of rows.entries()) {
    if (row.index !== index || row.stage !== plan[index] || row.signal !== "SIGKILL" || row.admissions !== 1 || !row.replayed || !row.reservation || row.decisions < 1 || row.replayDecisions !== row.decisions || [row.signatures, row.sendStarts, row.sends].some(n => !Number.isSafeInteger(n) || n < 0 || n > 1)) throw new Error("native kill invariant failed");
  }
}
