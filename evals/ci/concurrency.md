# Concurrent SDK admissions — CI-2, partial

Definition frozen 2026-10-06 before measurement. Queue 1,000 independent asynchronous
callers behind one shared barrier, then release all into one native synchronous SDK guard.
Each proposes a 1,000,000-lamport transfer to a distinct generated address, with a distinct
request identity. Seed 20261006 generates destinations; one window, fixed timestamp,
per-tx cap 1,000,000 and pending-window cap 7,000,000. No outcomes release reservations.

Quiet telemetry isolates policy; fee budget and latch threshold permit the full workload.
Require exactly seven admissions, all other proposals denied by over-window-cap, 1,000
decision records, distinct destinations/identities and 7,000,000 reserved lamports. No
work before releasing the barrier. This exercises contention from asynchronous callers
on a deliberately synchronous admission API, not parallel threads or separate writers.
Socket capacity, isolated signer, multi-process ownership, actual sends and durable
concurrency qualification remain separate requirements. No coefficient or threshold tuned.

## Evidence

Local Linux/Node 26.7.0, 2026-10-06; revision is the commit containing this receipt
(`git log -- evals/ci/concurrency.md`). Builder-authored, not independent evidence.
Two negative gate tests fail against a stub; the positive already passes
(`concurrency/red.txt`). Four final tests pass (`concurrency/green.txt`): 1,000 queued
callers, seven admissions, 993 over-window-cap denials, 1,000 records/destinations/identities,
7,000,000 reserved lamports. Regenerate: `node --test evals/ci/concurrency.test.ts`.
Normal root tests execute this profile on each approved Node CI runtime.

Initial typecheck rejects the optional rule type (`concurrency/initial-typecheck.txt`);
an absent rule now becomes an explicit failing evidence label. Missing bindings are omitted
from the distinct-ID count so absence cannot masquerade as a distinct identity.
The short-budget mutation initially survives because the fake short result already fails
an evidence count (`concurrency/initial-fault-miss.txt`). Strengthened that fixture to
isolate the budget floor; no workload or coefficient change.

Seven final faults caught (`concurrency/faults-final.txt`): reduced budget, over-admission,
missing evidence, wrong reservation total, wrong denial rule, missing barrier and disabled
pending-window enforcement. Regenerate: `node evals/ci/concurrency-faults.ts`. No final
miss; sources restored. In-memory single-guard evidence does not qualify disk, multi-process,
socket capacity, isolated host or live chain behaviour.

Final local verification: `npm test` 351 passes (`concurrency/full.txt`),
`npm run typecheck` exit zero (`concurrency/typecheck.txt`), four focused tests pass
(`concurrency/green-final.txt`). `npm run test:bite`: twenty-one campaigns / 140
caught faults, source restored (`concurrency/bite.txt`; count with `rg -c '^caught '`).
Prior replay commit `b758463` CI run 37483948590 passes all jobs, including the pinned
history on each approved Node runtime. No new dependency or protected harness change.
