import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { strict as assert } from 'node:assert';
const source = fileURLToPath(new URL('./measure.mjs', import.meta.url));
const tests = fileURLToPath(new URL('./measure.test.mjs', import.meta.url));
const original = readFileSync(source, 'utf8');
const definitionPath = fileURLToPath(new URL('./definition.json', import.meta.url));
const definitionBytes = readFileSync(definitionPath);
const faults = [
  ['population', "throw new Error('incomplete population')"],
  ['samples', "throw new Error('incomplete timing samples')"],
  ['clock', "throw new Error('invalid clock evidence')"],
  ['history', "throw new Error('frozen history differs')"],
  ['replay', "throw new Error('replay incomplete or divergent')"],
  ['operations', "throw new Error('mixed operations incomplete')"],
];
function run() {
  const result = spawnSync(process.execPath, ['--test', tests], { encoding: 'utf8', timeout: 30_000 });
  console.log(result.stdout); console.log(result.stderr);
  assert.equal(result.signal, null); assert.equal(result.error, undefined);
  return result;
}
try {
  assert.equal(run().status, 0);
  for (const [name, needle] of faults) {
    assert.equal(original.split(needle).length, 2);
    writeFileSync(source, original.replace(needle, 'void 0'));
    console.log(`FAULT ${name}`);
    const result = run();
    assert.equal(result.status, 1);
    assert.match(result.stdout, /tests 4/); assert.match(result.stdout, /fail 1/);
    assert.match(result.stdout, /ERR_ASSERTION/);
    for (const label of ['cancelled', 'skipped', 'todo']) assert.match(result.stdout, new RegExp(`${label} 0`));
    writeFileSync(source, original);
  }
} finally { writeFileSync(source, original); }
assert.equal(readFileSync(source, 'utf8'), original);
assert.equal(run().status, 0);
console.log('Six omissions caught; exact source restored and final control passes');
function preflight() {
  const result = spawnSync(process.execPath, [source, '--check-inputs'], { encoding: 'utf8', timeout: 30_000 });
  console.log(result.stdout); console.log(result.stderr);
  assert.equal(result.signal, null); assert.equal(result.error, undefined);
  return result;
}
try {
  assert.equal(preflight().status, 0);
  for (const fault of ['runtime', 'identity']) {
    const definition = JSON.parse(definitionBytes);
    if (fault === 'runtime') definition.node = 'v0.0.0';
    else definition.inputs['packages/sdk/src/guard.ts'] = '0'.repeat(64);
    writeFileSync(definitionPath, JSON.stringify(definition));
    console.log(`FAULT preflight ${fault}`);
    const result = preflight();
    assert.equal(result.status, 1);
    assert.match(result.stderr, fault === 'runtime' ? /frozen Node runtime differs/ : /frozen input differs: packages\/sdk\/src\/guard.ts/);
    writeFileSync(definitionPath, definitionBytes);
  }
} finally { writeFileSync(definitionPath, definitionBytes); }
assert.deepEqual(readFileSync(definitionPath), definitionBytes);
assert.equal(preflight().status, 0);
console.log('Runtime and input substitutions refused; exact frozen definition restored');
