# Isolated parallel package fault prototype

Proposed execution implementation only, 2026-10-10 Toronto. The maintained
gate is unchanged and remains failed as in CLAIMS S110. No product source,
fault population, installed assertion, process limit or readiness target changes.

Declare before measurement: extract all existing trusted fault declarations,
use isolated copies of the reviewed SDK, run the entire installed suite for
each fault, and require initial and restored controls in every worker. Force
compilation caching off. An outer observer enforces the same whole-invocation
limit as the maintained runner, independently of the prototype's cleanup timer.
SIGTERM stops only its own isolated process groups; it never mutates the original
candidate. Snapshot bytes/modes and bind script/test/prototype hashes first.

Validator tests fail first against the absent helper. Positive controls and
negative incomplete, cancelled, inconsistent, wrong-target, timeout, termination,
spawn-error and passing-mutant cases are required. The prototype refuses these
rather than treating incomplete execution as a caught product fault. Full run
qualification is measured below. The maintained gate remains unchanged.

## Results and retained failures

Reviewed base `826d05864271f3b2af05c8a8eb11243b1755c50f`, Linux x86-64,
Node 26.7.0. The outer observer returns status zero, no signal or error,
in 240,568.816306 ms against the unchanged 300,000 ms limit. All 144
original faults are caught by their named installed cases; all 19 installed
cases execute for every fault. Four isolated workers also pass eight complete
initial/restored controls. No compilation cache is used. The original candidate
bytes and modes remain unchanged. Definition, summary, termination and every
fault/control log are preserved in `parallel-experiment/`.

The absent validator produces ten initial failures. Its first planted-fault
battery catches timeout, population, target and signal faults, but misses two:
a control with status zero and failed cases, and an earlier forged footer hiding
an incomplete final footer. Preserve both misses in `validator-faults/initial.json`.
Add cases for those inputs, demonstrate both failures against their respective
mutants, then restore the existing validator. All twelve strengthened tests pass;
all six validator faults are caught. The runner source is exactly restored to
the measured definition's hash; the installed test inputs are unchanged.

This is a successful execution prototype, not a product performance benchmark
or a maintained gate pass. The earlier sequential and cache-configured timeouts
remain failed, as does the separate H11 baseline. No deadline extension, test
filter, product change or readiness waiver follows.

Later interruption qualification in `parallel-lifecycle.md` finds that SIGTERM
alone leaves an ignoring child and its parent waiting. The nominal completion
above remains valid; it does not establish universal timeout enforcement. Combine
the unapplied termination correction with the owner draft and requalify before
promotion. The maintained gate remains unchanged and failed.

## Exact owed edit

`parallel-experiment/owner-draft.patch` is an unapplied unified diff for the
authorised gate owner. It preserves the entire literal fault population and
existing initial control, delegates execution to the measured isolated runner,
and keeps the enclosing maintained-runner deadline unchanged. It adds initial
and restored controls in every worker. The draft is not the measured invocation:
its extra original control and import path require qualification after application.
The owner must also incorporate the validator tests into the maintained gate,
exercise interrupted-child cleanup and partial-campaign refusal, and bind the
resulting source revision before accepting the edit. The prototype's `revision`
field names the reviewed base, not a future patched revision. Do not promote it
as provenance for an untested patched gate. No protected file has been changed.

```bash
node --test evals/packaging/parallel-experiment.test.mjs
python evals/packaging/parallel-experiment/validator-faults.py
node evals/packaging/parallel-experiment/observe.mjs
```

This experiment is builder-authored and local. It is neither independent
security evidence nor a change to the actual protected gate. Any eventual
gate edit must be reviewable and supplied to its authorised owner with tests
and retained fault proof. The failed uncached and cache-configured campaigns
remain archived; neither is rewritten as a pass.

Unchanged product verification: all 879 native cases and typecheck pass.
Bound identities match for 51 product sources, 87 evaluation inputs, 86 emitted
files and the reviewed private archive, in `restored-identities.json`. Regenerate
`npm test` and `npm run typecheck`; this native pass does not erase quiet AST
or maintained-runner failures.
