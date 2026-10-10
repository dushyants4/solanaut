# Proposed parallel runner interruption qualification

Builder-authored local evidence, 2026-10-10 Toronto, Linux/Node 26.7.0.
Reviewed base `2dd8264b06dec9cc3fd48cfef79fb3ba20964f8f`. The S111 prototype
source remains byte-identical; actual maintained gates and all product code are
unchanged. S111's normal completion within its configured timeout does not prove
termination when a child ignores SIGTERM.

## Finding and correction proposal

The controlled fixture copies the exact prototype, retains its worker/control
logic, and replaces installed test children with idle processes that explicitly
ignore SIGTERM. Declare a separate artificial timer of 1,000 ms and observe after
three seconds. This fixture qualifies no installed case or product fault, and
does not alter the maintained campaign's 300,000 ms limit.

All four fixture children receive and ignore SIGTERM; the original parent still
waits. The acceptance assertion fails, CI-2, in `initial-red/`. Supervise cleanup
using only process groups reported by the current controlled fixture, never
process-name searches or earlier-run identities. All children are removed and
the incomplete parent returns failure. The initial observational reproduction
is also retained separately; its successful observation is not a gate pass.

The exact proposed correction sends SIGTERM once to each owned group, then
escalates to SIGKILL after the declared 100 ms grace if the child remains live.
Closing the child clears escalation. The corrected copy stops all four stubborn
children and returns failure for the incomplete campaign before the observation.
It does not acknowledge incomplete work or manufacture fault credit.
`corrected/termination-owner.patch` is an unapplied unified diff.

Three planted faults are caught: remove kill escalation, delay it beyond the
observation, or force incomplete execution to report success. Every fault case
fails its named CI-2 acceptance assertion and cleans up all controlled processes.
The restored corrected control passes. Original prototype and current bound
product/evaluation/emitted/archive identities remain unchanged.

```bash
python evals/packaging/parallel-lifecycle-probe.py
python evals/packaging/parallel-lifecycle-probe.py --corrected
uv run --script evals/packaging/parallel-lifecycle-probe.py --corrected
python evals/packaging/parallel-lifecycle-probe.py --corrected --fault skip-kill
python evals/packaging/parallel-lifecycle-probe.py --corrected --fault late-kill
python evals/packaging/parallel-lifecycle-probe.py --corrected --fault false-completion
```

The first and fault commands intentionally exit nonzero. Run serially. Preserve
new receipts separately when regenerating; the harness clears stale fixture PID
logs before launching and never kills children after their parent has finished.
Observation/cleanup/definition/summary/parent logs and exact owned identities are
retained under `parallel-lifecycle/`. Generated fixture code remains in repository
scratch and is reproducible from the hash-bound prototype and declared edits.

## What remains

The correction is applied only to generated fixture copies. Combine the exact
termination draft with HANDOFF O2 before considering promotion; freshly qualify
the complete unchanged installed/fault populations and the maintained entry
point. This controlled interruption test does not establish a universal hard
wall-clock limit, root-process crash recovery, arbitrary orphan cleanup, product
performance, independent security or stable-release readiness. The actual
maintained runner remains failed, S110/H11. No protected gate is changed.
