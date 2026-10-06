# ADR-012 option C — implementation receipt

Measured on 2026-10-05, Node 26.7.0, Keel 1.0.1 with its existing byte pins.
Builder-authored evidence; this does not replace Claude's RT-2 or a devnet rerun.

## Failed first

`node --test packages/sdk/test/latch-c.test.ts` against the Beta rule:
24 tests, 11 passing and 13 failing. Failures reproduce the premature single-REGROUND latch,
replay differences, rising fees, double signing and every scene-5 cap share.
Full output: [initial failure](latch-c/latch-red-behaviour.txt).

The first attempted run failed to parse a TypeScript parameter property in the new helper;
that fixture error was corrected before measuring behaviour and is not red-first evidence.
The initial typecheck also found a missing explicit generic on the sealed fixture; corrected.

## Passing implementation

`node --test packages/sdk/test/latch-c.test.ts`: 24 passing, no failures.
[Passing output](latch-c/latch-green.txt). LAT-1 to LAT-6 name the accepted ADR's obligations:

| ID | Evidence |
|---|---|
| LAT-1 | one REGROUND denial from an earlier rule does not latch |
| LAT-2 | consecutive REGROUND denials latch across a report and restart; a non-REGROUND decision breaks the pair |
| LAT-3 | Keel's own `loop-reground` denial latches immediately |
| LAT-4 | the consecutive-denial threshold still latches at DEFAULT |
| LAT-5 | a sealed Beta-style single-REGROUND latch diverges at `latch` under replay |
| LAT-6 | archived option-C streams reproduce their table and replay: benign streams, drains, loops and scene 5 |

Admission reads the previous decision from the record. Replay advances that same predecessor,
including malformed decisions. No new persistent field or coefficient was introduced.

## Planted faults

Each edit was applied separately to `guard.ts`, tested with the command above and reverted.
All seven caused exit 1 with assertion failures, not syntax failures. Full outputs are retained.

| Fault | Caught by | Output |
|---|---|---|
| any REGROUND denial latches (V0) | LAT-1, LAT-2, LAT-5 and affected streams | [V0](latch-c/fault-v0.txt) |
| remove the previous-denial arm | LAT-2 and drain/fee streams | [only Keel](latch-c/fault-only-keel.txt) |
| remove Keel's immediate-latch arm | LAT-3 and identical loops | [only predecessor](latch-c/fault-only-previous.txt) |
| use the last entry, including reports | LAT-2's report/restart case | [last entry](latch-c/fault-last-entry.txt) |
| omit the predecessor during replay | LAT-2 and stream replay checks | [replay](latch-c/fault-no-replay-predecessor.txt) |
| remove the denial threshold | LAT-4 and distinct drains | [threshold](latch-c/fault-no-denial-threshold.txt) |
| skip intervening decisions when finding the predecessor | LAT-2's malformed intermediate decision | [adjacency](latch-c/fault-skip-intervening-decision.txt) |

To regenerate a fault, replace the named expression in `evaluate`, `check` or `replay`, run the
battery, then restore the accepted expression. LAT-3 and LAT-4 already passed against the old rule;
their initial failure evidence is the corresponding planted fault.

## Accepted historical replay break

No JSONL records are tracked (`git ls-files '*.jsonl'`). These available scratch records each
replayed with exit 0 before the change and exit 1 after it. Their bytes were not rewritten.

| Record | Policy | First divergence |
|---|---|---|
| `.sandbox/devnet/guard.jsonl` | `.sandbox/devnet/policy.json` | seq 8, `latch`: recorded true, recomputed absent |
| `.sandbox/local-scenes/guard.jsonl` | `.sandbox/local-scenes/policy.json` | seq 8, `latch`: recorded true, recomputed absent |
| `.sandbox/cockpit/guard.jsonl` | `.sandbox/cockpit/policy.json` | seq 9, `latch`: recorded true, recomputed absent |

Regenerate each: `npm run replay -- <record> <policy>`. Pre-change code: `e925f1d`.
Restore retains the historical latch as a recorded fact; recomputation names the accepted difference.
Evaluation-version compatibility remains separate work.

## Limits and remaining evidence

The scenes reproduce option C offline. Devnet scenes were not rerun: funding remains H1 in
`docs/HANDOFF.md`. S12 remains the historical devnet claim, including its old latch; withdraw that
note only after the funded devnet rerun. The archived R&D runner intentionally refuses to run
after the source rule changes; it remains unchanged. LAT-6 is the maintained regression command.
Failed-outcome runs and alternating loops remain open under RT-3.
