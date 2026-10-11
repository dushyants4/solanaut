# ADR-024 · A deterministic budget for failed outcomes

**Status: proposed, not accepted.** 2026-10-11. Answers the remaining
failed-outcome and alternating-loop questions in SPEC §12 / RT-3. No dependent
policy, evaluator, record or signer change is authorised before human acceptance.
ADR-012 option C, ADR-019 and every readiness gate remain required.

## Context and evidence

`evals/release/current-traffic.md` reproduces the original frozen streams on
the current product, CLAIMS S135. Identical and escalating streams stop;
alternating and distinct failed-outcome streams continue throughout their
specified horizons. The benign population passes its existing gate. The
earlier `evals/sdk/latch-variants.md` and SPEC §12 already identify these limits.
These are builder-authored synthetic results, not independent security evidence.

Changing the REGROUND trip rule cannot stop a stream that never produces a
REGROUND denial. Joining unrelated effects into one intent would change payment
identity. Tuning Keel or sensor coefficients against observed streams risks
fitting the evaluation. The published Keel package remains unchanged.

## Proposed decision

Add an explicit operator-signed policy budget separate from spending caps and
Keel. Proposed fields are `outcomes.maxFailures` and `outcomes.windowMs`, each
a positive safe integer. Values and presets must precede fresh qualification
definitions. No default or stop-turn target is inferred from these measurements.

Count each admitted decision's first valid terminal `failed` report once,
globally within the guard, across effects, amounts, destinations and intent keys.
Use durable trusted report observation time in `(now - windowMs, now]`.
Landed reports do not erase other failures. Duplicate reports, denied proposals,
unknown observations and expired reports add none; expiry is not failed-execution
evidence. Existing reservation, fee, receipt and final-outcome rules still apply.

At the budget, latch in the same durable transition that accepts the report.
Acknowledgement follows persistence. Append failure cannot expose an unlatched
usable guard. Subsequent proposals refuse until verified operator release;
prior admitted/signed attempts are not cancelled or released. Reconciliation
and durable replies continue. The bound is on later admissions, not outstanding
transactions that may still execute.

SDK mode continues to trust caller outcome/time and remains bypassable by a
caller holding the key. Isolated reports remain hints: only the authoritative
signer reconciler creates counted reports under ADR-019's RPC rules. Forged caller
telemetry must neither release reservations nor trip the budget. Provider loss
is degraded denial, not invented failure evidence.

## Release, policy and history

Time, success, policy replacement and restart never clear a latch. The existing
head-bound authenticated release starts a new failure-budget epoch at its
durable sequence. Earlier failed reports are excluded thereafter; a pre-release
pending attempt first reported failed afterwards counts in the new epoch.
Release does not change its reservation/lifecycle. No unsigned reset or new
agent socket operation is introduced.

A higher signed policy changes the budget/window without resetting the epoch.
Before activation reconstruct eligible reports from verified retained history.
At the new budget, the durable policy activation latches. Missing evidence
refuses activation/readiness without discarding history. Window extensions cannot
use a pruned cache. Compact retention additionally requires ADR-023 acceptance.

Use an explicitly versioned policy schema and evaluation profile. Old records
keep old semantics; never insert retrospective latches. New-profile activation
derives the initial count from eligible historical failed reports and the latest
verified release, respecting the guard mode's source trust. Legacy profiles do
not silently acquire this behaviour. Unsupported readers or binary rollback
refuse. No replay break beyond accepted ADR-012 is proposed.

Replay reconstructs count, epoch and latch from authenticated policy/report/release
events. Checkpoints bind them to the same durable endpoint/profile; numerical
Keel state is still rebuilt by replay. Snapshots cannot replace missing failure
history. Precise format allocations and requirement IDs follow acceptance,
before code. Maintenance and upgrades retain ADR-019's contracts.

## Required acceptance evidence

Tests fail first at threshold-minus-one, threshold and window boundaries;
duplicate/late reports; shape and amount changes; interleaved success; release
epochs and pending attempts across release; larger windows and lowered budgets.
Include forged isolated reports, conflicting RPC evidence, crashes around report
and activation persistence, storage failure, competing writers, restored latches
and incompatible profile/snapshot history. Packed consumers get the same cases.

Plant omitted counting, per-intent counting, landed-reset, duplicate counting,
wrong boundary, unsigned reset, premature acknowledgement, caller-authority and
unverified cached-history faults. Preserve failures and misses. Compare live,
restore and full replay on the approved matrix. RT-2 and audit remain independent.

Freeze new workloads, seeds, values and analysis before measurement. Retain the
original definition and its limitations. Evaluate fresh benign traffic, mixed
success/failure, burst admissions, delayed/out-of-order reconciliation,
alternating and distinct effects. Report first refusal and outstanding admissions.
Keep false-stop confidence, performance, coverage, mutation, reliability and soak
targets unchanged. A failed gate returns the design for review, not tuning against
the failed population.

## Costs, alternatives and deferred work

An incident may stop useful unrelated traffic. Already admitted work can remain
outstanding. Failure-window reconstruction adds state/I/O; profile changes add
migration work. Diagnostics must identify evidence, window, epoch and recovery
action without exposing keys.

A consecutive-failure rule allows successful interleaving to reset the run.
Per-intent limits leave changing effects unjoined. Current behaviour can instead
remain with its limits stated, without claiming universal stopping. Recommend
the cumulative window because its bound is explicit and independent of shape
matching or coefficient selection. The human decides this trade-off and policy
values before fresh qualification.

Unknown/expired outcomes, compromised hosts, key bypass and fleet-wide bounds
are not solved. No threshold relaxation, signer budget expansion, dependency,
mainnet scope, accepted default or publication permission follows.
