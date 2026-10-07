# CI-2 — actual detached run supervision

2026-10-07 · builder-authored local Linux evidence, Node 26.7.0, base `3a142ea`
plus the recorded candidate. This is an operator helper, not a signer API or a
completed mutation qualification.

The launcher freezes a command and external input digest in a fresh private directory.
A detached supervisor observes the actual child's close status, signal and launch
errors. Deadlines and interruption prevent eligibility. A surviving process group
is terminated and cannot qualify as normal success. The launcher can exit or lose
its entire process group while the supervisor retains its own output and result.

Exclusive result publication syncs its file and directory before writing a separate
commit digest. Readers verify private ownership/modes, the digest and the ticket's
worker/run/input/command identities. No result or uncommitted result is a pass.
The separate completion checker still decides structural eligibility.

The initial stub fails (`run-supervisor-red.txt`). Later tests expose acceptance of
a foreign worker and acceptance after a directory-sync failure. Partial commit and
changed result bytes also fail before their checks exist. These outputs are retained
beside the passing outputs. Eighteen focused cases pass; nineteen real faults are
caught, and restored source passes (`run-supervisor-final.txt`,
`run-supervisor-faults.txt`). Inventory refuses the unregistered campaign before
registration (`run-supervisor-inventory-red.txt`).

Regenerate: `node --test evals/ci/run-supervisor.test.ts`,
`node evals/ci/run-supervisor-faults.ts`, `npm run typecheck` and
`env -u SOLANAUT_PROPERTY_TRIAL nice -n 19 npm test -- --test-concurrency=1`.
The fault aggregate runs in a separately frozen candidate and must restore all
recorded source and compiled artefacts exactly.

Ordinary root integration passes all 531 cases (`root.txt`); typecheck passes
(`typecheck.txt`). The first isolated setup runs from the wrong directory and fails
its copy assertion. Its prematurely started old aggregate is stopped, its active
campaign ends, and its partial output is retained (`isolated-setup-aborted.txt`).
The corrected root-based copy freezes 805 inputs and 65 compiled files
(`candidate-manifest.json`). This setup failure is not qualification evidence.
Pre-sync close passes nine gates and refuses the uncommitted tree as required.
The corrected isolated aggregate exits zero across thirty-seven campaigns and
350 caught-fault lines (`isolated-bite.txt`). Every one of the 805 frozen inputs and
65 compiled files restores exactly, including complete compiled inventory; all
root TypeScript and package inputs match the frozen candidate (`restoration.json`).
Private sync and hosted validation follow; this aggregate is builder-authored.

Limits: this trusted same-user Linux helper cannot authenticate a compromised host.
It does not isolate environment inputs, stop descendants that deliberately escape
their process group, or establish power-loss durability. Supervisor SIGKILL can
leave an unfinished run and needs external containment; no completion may be inferred.
Full mutation integration, supervisor-death recovery and hosted qualification remain
owed. The original orphaned mutation run has not been adopted or qualified.

Process semantics are checked against the official Node documentation for
[detached children](https://nodejs.org/api/child_process.html#optionsdetached),
[close events](https://nodejs.org/api/child_process.html#event-close) and
[signals](https://nodejs.org/api/process.html#processkillpid-signal).
Documentation describes current Node; this receipt measures the pinned runtime above.
