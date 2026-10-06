import * as fc from "fast-check";
import { randomBytes } from "node:crypto";
export const MIN_RUNS = 10_000;
export async function checkAsyncProperty<T extends [unknown, ...unknown[]]>(id: string, property: fc.IAsyncProperty<T>, runs = MIN_RUNS): Promise<void> {
  validateCompletion({ failed: false, numRuns: runs, numSkips: 0 }, runs);
  const seed = propertySeed(process.env.SOLANAUT_PROPERTY_SEED);
  console.log(`property starting: ${id}; seed=${seed}; requested=${runs}`);
  const result = await fc.check(property, { numRuns: runs, seed });
  if (result.failed) throw new Error(`property failed: ${id}\n${fc.defaultReportMessage(result)}`);
  validateCompletion(result, runs);
  console.log(`property completed: ${id}; seed=${seed}; runs=${result.numRuns}; skips=${result.numSkips}`);
}
export function validateCompletion(result: { failed: boolean; numRuns: number; numSkips: number }, requested: number): void {
  if (!Number.isSafeInteger(requested) || requested < MIN_RUNS) throw new Error("property run budget below required floor");
  if (result.failed) throw new Error("property failed");
  if (result.numRuns !== requested || result.numSkips !== 0) throw new Error("property run incomplete or skipped");
}
export function propertySeed(value?: string): number {
  if (value === undefined) return randomBytes(4).readInt32LE();
  const seed = Number(value);
  if (!Number.isInteger(seed) || seed < -2147483648 || seed > 2147483647 || String(seed) !== value) throw new Error("invalid property seed");
  return seed;
}
export function checkProperty<T extends [unknown, ...unknown[]]>(id: string, property: fc.IProperty<T>, runs = MIN_RUNS): void {
  validateCompletion({ failed: false, numRuns: runs, numSkips: 0 }, runs);
  const seed = propertySeed(process.env.SOLANAUT_PROPERTY_SEED);
  console.log(`property starting: ${id}; seed=${seed}; requested=${runs}`);
  const result = fc.check(property, { numRuns: runs, seed });
  if (result.failed) throw new Error(`property failed: ${id}\n${fc.defaultReportMessage(result)}`);
  validateCompletion(result, runs);
  console.log(`property completed: ${id}; seed=${seed}; runs=${result.numRuns}; skips=${result.numSkips}`);
}
