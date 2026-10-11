import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, writeFileSync, rmSync, symlinkSync } from 'node:fs';
import { resolve, dirname } from 'node:path';

const root = process.cwd();
const helper = process.env.ASSERTION_HISTORY_HELPER ?? resolve('evals/release/assertion-history.py');
const base = resolve('.sandbox/assertion-history-fixtures'); mkdirSync(base, { recursive: true });
function fixture(run) {
  const repo = mkdtempSync(base + '/repo-');
  const git = (...args) => {
    const result = spawnSync('git', ['-c', 'user.name=fixture', '-c', 'user.email=fixture@example.invalid', '-c', 'core.hooksPath=/dev/null', ...args], { cwd: repo, encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr); return result.stdout.trim();
  };
  const put = (path, body) => { mkdirSync(dirname(resolve(repo, path)), { recursive: true }); writeFileSync(resolve(repo, path), body); };
  const commit = () => { git('add', '-A'); git('commit', '--quiet', '-m', 'synthetic change'); return git('rev-parse', 'HEAD'); };
  const inventory = (baseline, head) => spawnSync('python', [helper, '--repo', repo, '--baseline', baseline, '--head', head], { cwd: root, encoding: 'utf8' });
  try { git('init', '--quiet', '-b', 'main'); run({ repo, git, put, commit, inventory }); }
  finally { rmSync(repo, { recursive: true, force: true }); }
}

test('PUB-1 assertion preparation retains edits to tests added after baseline', () => fixture(({ put, commit, inventory }) => {
  put('packages/sdk/test/a.test.ts', 'assert.equal(value, 2);\n'); const baseline = commit();
  put('packages/sdk/test/a.test.ts', 'assert.equal(value, 1);\n');
  put('evals/new.test.mjs', 'assert.equal(value, 3);\n'); commit();
  put('evals/new.test.mjs', 'assert.equal(value, 1);\n'); const head = commit();
  const result = inventory(baseline, head); assert.equal(result.status, 0, result.stderr);
  const report = JSON.parse(result.stdout);
  assert.deepEqual(report.counts, { A: 1, M: 2, D: 0, T: 0 });
  assert.equal(report.edges.length, 3); assert.equal(report.commits.length, 2);
  assert.equal(report.assertionEditsReviewed, false); assert.equal(report.fileBlobsRead, false);
}));

test('PUB-1 assertion preparation records deletion and rename as complete old/new paths', () => fixture(({ repo, put, commit, inventory }) => {
  put('evals/a.test.ts', 'assert.equal(value, 2);\n'); const baseline = commit();
  rmSync(resolve(repo, 'evals/a.test.ts')); put('evals/b.test.ts', 'assert.equal(value, 2);\n'); const head = commit();
  const result = inventory(baseline, head); assert.equal(result.status, 0, result.stderr);
  const report = JSON.parse(result.stdout); assert.equal(report.counts.D, 1); assert.equal(report.counts.A, 1);
  assert.equal(report.edges.some(edge => edge.path === 'evals/a.test.ts' && edge.status === 'D'), true);
}));

test('PUB-1 assertion preparation includes branch commits and every merge-parent edge', () => fixture(({ git, put, commit, inventory }) => {
  put('evals/a.test.ts', 'assert.equal(value, 2);\n'); put('evals/b.test.ts', 'assert.equal(value, 2);\n'); const baseline = commit();
  git('checkout', '--quiet', '-b', 'branch'); put('evals/a.test.ts', 'assert.equal(value, 1);\n'); const branch = commit();
  git('checkout', '--quiet', 'main'); put('evals/b.test.ts', 'assert.equal(value, 1);\n'); commit();
  git('merge', '--quiet', '--no-ff', '--no-edit', 'branch'); const head = git('rev-parse', 'HEAD');
  const result = inventory(baseline, head); assert.equal(result.status, 0, result.stderr);
  const report = JSON.parse(result.stdout); assert.equal(report.commits.length, 3);
  assert.equal(report.commits.includes(branch), true); assert.equal(report.counts.M, 4);
  assert.equal(report.edges.filter(edge => edge.commit === head).length, 2);
}));

test('PUB-1 assertion preparation refuses aliases, missing objects and unrelated baseline', () => fixture(({ git, put, commit, inventory }) => {
  put('evals/a.test.ts', 'assert.equal(value, 2);\n'); const baseline = commit();
  assert.equal(inventory(baseline, baseline).status, 0);
  assert.notEqual(inventory(baseline, 'HEAD').status, 0);
  assert.notEqual(inventory(baseline, '0'.repeat(40)).status, 0);
  git('checkout', '--quiet', '--orphan', 'unrelated'); git('rm', '--quiet', '-rf', '.');
  put('evals/b.test.ts', 'assert.equal(value, 1);\n'); const head = commit();
  assert.notEqual(inventory(baseline, head).status, 0);
}));

test('PUB-1 assertion preparation refuses a test outside its bounded code roots', () => fixture(({ put, commit, inventory }) => {
  put('evals/a.test.ts', 'assert.equal(value, 2);\n'); const baseline = commit();
  put('other/a.test.ts', 'assert.equal(value, 1);\n'); const result = inventory(baseline, commit());
  assert.notEqual(result.status, 0); assert.match(result.stderr, /test path outside bounded roots/);
}));

test('PUB-1 assertion preparation refuses a test symlink before any blob read', () => fixture(({ repo, put, commit, inventory }) => {
  put('evals/a.test.ts', 'assert.equal(value, 2);\n'); const baseline = commit();
  rmSync(resolve(repo, 'evals/a.test.ts')); symlinkSync('unavailable', resolve(repo, 'evals/a.test.ts'));
  const result = inventory(baseline, commit()); assert.notEqual(result.status, 0);
  assert.match(result.stderr, /test object is not a regular blob/);
}));
