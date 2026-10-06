# Verified process-kill recovery — CI-2, partial

Definition frozen 2026-10-06 before measurement. One hundred independent trials of the
existing 160-step SDK restart workload. Seed 202610061 chooses persisted prefixes of
1–159 steps. A child appends that prefix using kernel ownership, acknowledges its exact
length and stays alive. Parent sends SIGKILL and verifies the actual exit signal, then
opens the same history with exclusive kernel ownership, completes the workload and checks
all hashes against an uninterrupted reference; replay must also pass.

Require 100 verified kills, 100 identical completions, 100 successful replays. Reject
unexpected exit, missing acknowledgement, invalid budgets and incomplete results. Child
has a deadline and is killed on failure; each trial records its chosen point. Scratch is
under `.sandbox/solanaut-1/kills/`; failures and process output are preserved in receipts.

This deliberately kills after acknowledged persistence. It does not claim random points
inside fsync, signing/send boundaries, power loss or isolated-signer recovery. Existing
torn-write/storage fault tests are distinct evidence. No live chain or key-file access.

## Evidence

Local Linux/Node 26.7.0, 2026-10-06; revision is the commit containing this receipt
(`git log -- evals/ci/kills.md`). Builder-authored evidence. Two gate tests fail against
the stub, the positive already passes (`kills/red.txt`); three pass after implementation
(`kills/green.txt`). Added a fourth actual owner-death/reopen regression to the root suite.

The complete battery (`kills/hundred.txt`) verifies 100 SIGKILL exits after exact prefix
acknowledgement, 100 histories completed identically to the uninterrupted reference and
100 successful replays. Each chosen point and scratch record path is retained. Regenerate:
`npm run test:kills`. Seed 202610061, prefixes 1–159, original 160-step workload/sensor v1,
Keel 1.0.1. No process remains after completion. The same command has a dedicated pinned
Ubuntu 24.04/Node 26.7.0 CI job; actual pushed CI evidence follows the tested revision.

Seven planted faults caught (`kills/faults.txt`): short count, missing completion/replay,
ignored signal/acknowledgement, sending SIGTERM instead of SIGKILL, skipping state restore.
Regenerate: `node evals/ci/kill-faults.ts`; `node --test evals/ci/kills.test.ts`. No final
miss; all sources restored and child processes reaped. Nothing establishes unacknowledged
write, signing/send, power-loss or isolated-user recovery.

Prior queued-admission commit `3c36cb6` CI run 37485168194 passes every job and its
post-push close passes ten checks. No new dependency or protected harness change.

Final local validation: `npm test` 355 passes (`kills/full.txt`), `npm run typecheck`
exit zero (`kills/typecheck.txt`). `npm run test:bite`: twenty-two campaigns / 147
caught faults, all sources restored (`kills/bite.txt`; count using `rg -c '^caught '`).
No validator, service or kill child remains running. Scratch histories are synthetic.
