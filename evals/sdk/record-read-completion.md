# Complete record reads before repair

Builder-authored local evidence, 2026-10-09 Toronto, Linux/Node 26.7.0,
base `67948e6` plus candidate. ADR-019 recovery/durability; STO-5, SIG-8, OWN-2.

## Finding and correction

A short result returned by the complete-file reader is treated as a torn last
line. Startup truncates the actual acknowledged entry even though descriptor
metadata never changed. Oversized results likewise proceed to repair instead of
refusing an inconsistent read. Four manual/kernel cases fail first; two genuine
torn UTF-8 recovery cases remain positive controls.

Read raw bytes, require their count to match the captured physical descriptor
size, and only then repair at the last byte newline boundary. Decode complete
lines afterwards. Preserve original bytes and release failed-startup ownership
on refusal. Existing metadata/inode checks, formats and policy semantics remain.
Whole-file allocation stays unbounded; this is not power-loss qualification or
protection against a privileged host returning mutually consistent false evidence.

Earlier read-mutation fixtures accept either the former string result or the new
buffer result, retaining their real descriptor mutation. The decoded-byte-count
fault initially fails with an ordinary error; the strict campaign rejects that
diagnostic. Preserve it and strengthen the positive control with `doesNotThrow`,
so refusing valid recovery produces a behavioural assertion. Do not weaken the
checker. Both source and installed previous-candidate failures are retained.

Definition 41/seed 41587 is declared before full measurement, selecting 556 cases
while retaining every previous source/test, floor, wait and process/product limit.

The initial full run executes 862 cases: 859 pass, two checkpoint fixtures fail
because their global `readSync` injection now also intercepts raw journal reads,
and the unchanged staged-baseline wait fails. Preserve all three failures.
Scope checkpoint faults and read counters to the actual checkpoint inode; retain
every fault, fallback assertion and case. The focused checkpoint suite then
passes. Declare definition 42/seed 42719, still selecting 556 cases, before the
corrected full run. No timeout, process limit or coverage floor changes.

```bash
node --test --test-isolation=none packages/sdk/test/storage-failures.test.ts packages/sdk/test/ownership.test.ts
node evals/sdk/ownership-faults.ts
npm run typecheck
npm run release:prepare
node --test evals/packaging/packed-sdk.test.ts
node evals/packaging/faults.ts
npm test
npm run test:coverage -- --serial
uv run --script tools/session_close.py --slug codex-solanaut-1
```

## Status

Raw evidence lives in `evals/sdk/record-read-completion/`. All thirteen source
faults and 134 compiled faults catch, restoring their passing baselines. Thirty
focused and sixteen installed cases pass. Corrected native and quiet serial AST
each pass all 862 cases; corrected typecheck exits zero and unchanged AST floors
pass. Record coverage is 307/316 statements and 181/190 branches; private facade
109/112 and 46/48. Bound product/evaluation/emitted-file/archive hashes match
after restoration and corrected qualification. The initial failed runs remain.
No independent security, full mutation score, bounded recovery, signer budget
or stable release is claimed. This passing run does not erase earlier wait failures;
H9/H11 remain open. Local Git commits/bundles only, no remote push.
