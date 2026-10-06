// SIG/POL: sequential mutations of host composition, never concurrent with importing tests.
import { strict as assert } from "node:assert";
import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
const path = "apps/signer/src/service.ts"; const original = readFileSync(path, "utf8");
const faults = [
  ["accept-unsigned-bootstrap", 'const authorization = Object.freeze({ ...options.authorization }); const policy = verifyPolicyAuthorization(options.policy, authorization);', 'const authorization = undefined as never; const policy = options.policy as ReturnType<typeof verifyPolicyAuthorization>;'],
  ["ignore-history-mode", '(s.mode & 0o777) !== mode', "false"],
  ["claim-key-isolation", "keyIsolation: false", "keyIsolation: true"],
  ["hide-recovery-error", "recoveryIncomplete = results.some((r) => !r.complete)", "recoveryIncomplete = false"],
  ["release-before-drain", "await Promise.allSettled([...work]); guard.close();", "guard.close(); await Promise.allSettled([...work]);"],
  ["skip-work-drain", "await Promise.allSettled([...work]);", "void work;"],
  ["skip-recovery-tracking", "return track(core.recover().then((results) => { recoveryIncomplete = results.some((r) => !r.complete); return results; }));", "return core.recover().then((results) => { recoveryIncomplete = results.some((r) => !r.complete); return results; });"],
  ["allow-recovery-after-stop", 'function recover() {\n    if (closing) return Promise.reject(new Error("signer is stopping"));', "function recover() {\n    void closing;"],
] as const;
const battery = () => spawnSync(process.execPath, ["--test", "apps/signer/test/service.test.ts"], { encoding: "utf8", timeout: 30_000 });
const baseline = battery(); assert.equal(baseline.status, 0, baseline.stdout + baseline.stderr);
for (const [name, from, to] of faults) {
  assert.ok(original.includes(from), `missing fault site: ${name}`);
  assert.equal(original.indexOf(from), original.lastIndexOf(from), `ambiguous fault site: ${name}`);
  try {
    writeFileSync(path, original.replace(from, to)); const result = battery(); const output = result.stdout + result.stderr;
    assert.equal(result.status, 1, output); assert.match(output, /tests 8/); assert.match(output, /AssertionError/);
    console.log(`caught service fault: ${name}`);
  } finally { writeFileSync(path, original); }
}
const restored = battery(); assert.equal(restored.status, 0, restored.stdout + restored.stderr);
console.log("All service faults caught; restored source passes");
