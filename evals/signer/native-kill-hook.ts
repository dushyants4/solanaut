// Test-only process checkpoints. Never installed or enabled by the production executable.
import fs from "node:fs";
import crypto from "node:crypto";
import { syncBuiltinESMExports } from "node:module";
const target = process.env.SOLANAUT_NATIVE_KILL_STAGE, record = process.env.SOLANAUT_NATIVE_KILL_RECORD;
if (!target || !record) throw new Error("explicit native checkpoint configuration required");
const originalWrite = fs.writeSync, originalSync = fs.fsyncSync, originalSign = crypto.sign;
let stopped = false, last: any;
function owned(fd: number): boolean {
  try { const a = fs.fstatSync(fd), b = fs.lstatSync(record!); return a.dev === b.dev && a.ino === b.ino; } catch { return false; }
}
function checkpoint(stage: string) {
  if (!stopped && stage === target) {
    stopped = true;
    originalWrite(1, JSON.stringify({ checkpoint: stage }) + "\n");
    process.kill(process.pid, "SIGSTOP");
  }
}
fs.writeSync = ((...args: any[]) => {
  if (owned(args[0])) {
    const value = typeof args[1] === "string" ? args[1] : Buffer.from(args[1]).subarray(args[2] ?? 0, (args[2] ?? 0) + (args[3] ?? args[1].length)).toString();
    try { last = JSON.parse(value.trim()); } catch { last = undefined; }
    if (last?.kind === "decision" && last.request) checkpoint("before-decision-write");
  }
  return Reflect.apply(originalWrite, fs, args);
}) as typeof fs.writeSync;
fs.fsyncSync = ((fd: number) => {
  const row = owned(fd) ? last : undefined;
  const name = row?.kind === "decision" && row.request ? "decision" : row?.kind === "redeem" ? "redeem" : row?.kind === "report" ? "report" : row?.kind === "signing" ? row.event.stage : undefined;
  if (name) checkpoint("before-" + name + "-sync");
  originalSync(fd);
  if (name) checkpoint("after-" + name + "-sync");
}) as typeof fs.fsyncSync;
crypto.sign = ((...args: any[]) => { const value = Reflect.apply(originalSign, crypto, args); checkpoint("after-sign"); return value; }) as typeof crypto.sign;
syncBuiltinESMExports();
