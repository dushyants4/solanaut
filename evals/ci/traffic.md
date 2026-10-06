# RT-1 / RT-3 — frozen benign traffic and failed-outcome streams

2026-10-06 · builder-authored Linux SDK evidence · Node 26.7.0, published pinned
Keel 1.0.1 and actual sensor v1. Revision: commit containing this receipt. Definition
and seeds are in `traffic-definition.md`, written before measurement. No coefficients,
rules, caps or accepted thresholds change. Root validation passes 457 cases and the unchanged
coverage floors (`../sdk/archive-anchor/full-final.txt`, `../sdk/archive-anchor/coverage.txt`).
All 31 maintained campaigns catch 260 faults with restored sources
(`../sdk/archive-anchor/bite.txt`). Close and hosted CI follow private sync.

## Failures and maintained faults

Seven gate cases fail against stubs; one invalid-input case already passes because the
stub throws. Three workload and two runner cases also fail first. Retain `initial-red.txt`,
`workload-red.txt` and `runner-red.txt`. The first confidence implementation returns a
floating value just below one for an all-refused population (`endpoint-failure.txt`);
the exact analytic endpoint is now explicit, without changing the interval definition.

A planted population fault survives: its short fixture also trips completion. Keep
`initial-fault-miss.txt`. The revised short fixture reduces proposed and completed counts
together, so the population check must do its own work. This changes no traffic definition
or seed. Thirteen focused cases and eighteen final faults pass (`faults.txt`); sources
restore. Faults cover completion, inventory/seeds, confidence/counts, workload properties,
guard policy, outcome records and loop reporting. Typecheck is clean (`typecheck.txt`).

## Measurement

`traffic/measurement.txt` retains the whole result, including every loop posture.
All five defined profiles complete 500 proposals each. Zero of 2,500 proposals are refused.
The unrounded Wilson upper endpoint is 0.0015342823603537858 (fraction), below the existing
2% target. The displayed upper bound rounded upwards is 0.154%. Every refusal would count,
including subsequent latched refusals; no operator release or excluded proposal.
Every allowed proposal has an immediate synthetic landed report, and history reconciles.

| Failed-outcome loop | First admission refusal |
|---|---|
| Identical | turn 3, `loop-reground` |
| Escalating priority price | turn 4, `intent-attempts-exhausted` |
| Alternating shapes and amounts | none within 60 proposals |
| Distinct payments with failed outcomes | none within 60 proposals |

The latter two streams reach INHIBIT while continuing to admit their small permitted
payments. This is a retained limitation, not a successful detection claim. Per-transaction
and window policy limits remain in force; this battery neither changes them nor proves an
on-chain bound. RT-3's architectural decision and independent review remain owed.

## Regeneration and limits

`node --test evals/ci/traffic*.test.ts`, `node evals/ci/traffic-faults.ts`,
`node evals/ci/traffic-run.ts`. This is synthetic legacy SOL traffic through the trusted,
unsigned in-memory SDK with caller-supplied artificial times/outcomes. No real clock,
RPC, token programme, isolated signer, key isolation, signature or chain execution evidence.
Resource load from the concurrent isolated Stryker run does not supply telemetry or time
to these deterministic streams; their test durations are not performance measurements.
Outside-developer, independent red-team and all other Alpha/stable gates remain required.
