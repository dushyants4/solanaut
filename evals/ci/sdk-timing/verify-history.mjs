import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { strict as assert } from 'node:assert';
import { replay } from '../../../packages/sdk/src/guard.ts';
import { WORKLOAD_POLICY } from '../../../packages/sdk/test/support/workload.ts';
const definition = JSON.parse(readFileSync(new URL('./definition.json', import.meta.url)));
const bytes = readFileSync(process.argv[2] ?? new URL('./measured/history.jsonl', import.meta.url));
const entries = bytes.toString('utf8').trimEnd().split('\n').map(line => JSON.parse(line));
assert.equal(entries.at(-1).hash, definition.head);
const result = await replay(entries, WORKLOAD_POLICY);
assert.equal(result.ok, true, JSON.stringify(result.divergence));
assert.equal(result.decisions, definition.decisions);
console.log(JSON.stringify({ ...result, entries: entries.length, head: entries.at(-1).hash,
  sha256: createHash('sha256').update(bytes).digest('hex'), fromActualPersistedBytes: true }));
