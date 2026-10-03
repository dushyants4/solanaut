# Fee escalation against landed payments: one rule, measured

An R&D measurement for [docs/RISKS.md](../../docs/RISKS.md) RK20 and the open question in
[docs/SPEC.md](../../docs/SPEC.md) §12. It is not a gate: no rule in `packages/` changed.

## The question

The independent evaluator ran 3,000 benign payments whose priority fee varies as a wallet's estimate does. Sensor v1
stopped 15 of them (0.50%, 95% interval 0.30–0.82%), and each stop latched the guard
([independent/e3-edges/REPORT.md](../independent/e3-edges/REPORT.md)). The cause is one scoring rule in
`sensor.ts`: "the same shape at higher fees" scores 0.8, fee escalation, even when the earlier payment landed. A
payment that landed is done, so paying the next one at a higher fee is not escalating anything.

| | "The same shape at higher fees" scores 0.8 … |
|---|---|
| **V1** (as built) | always |
| **F1** | only when the earlier payment did not land |

The same intent at other fees (a retry of one payment that has not landed) scores 0.8 in both. That is the
rising-fee loop's case, and F1 leaves it alone.

## Method

`run.py` copies the SDK into `.sandbox/fee-exp`, which is gitignored, and switches the rule there with `FEE_VARIANT`.
It refuses to run if the rule in `packages/sdk/src/sensor.ts` has changed. Per variant it runs:
- the evaluator's batteries (`evals/independent/e3-edges/tests/batteries.test.mjs`): the three loops; benign at a
  constant fee; benign with varied fees, seeds 3003 to 3007;
- the SDK's own suite, against the patched copy.

## Results, 2026-10-03

| | V1: sensor v1 as built | F1: escalation by shape only against a payment that did not land |
|---|---|---|
| identical failing retries | turn 3 (`loop-reground`) | turn 3 (`loop-reground`) |
| rising fees, failing | turn 4 (`intent-attempts-exhausted`) | turn 4 (`intent-attempts-exhausted`) |
| two shapes alternating | not stopped in 30 | not stopped in 30 |
| benign, constant fee, 600 at the expected rate | 0 of 600 | 0 of 600 |
| benign, constant fee, 600 in bursts | 0 of 600 | 0 of 600 |
| benign, varied fees, 5 × 600 | 15 of 3,000 (0.50%, 95% interval 0.30–0.82%) | 0 of 3,000 (0.00%, 95% interval 0.00–0.13%) |
| the SDK's own suite, in the copy | 143 pass, 5 fail | 143 pass, the same 5 fail |

The 5 failures are the same under both variants. They are the tests that spawn scripts or child processes by path
(`npm run replay`, `pin-table`, the lock and restart batteries), which the copy's layout breaks. In the repository
itself, all 154 pass.

## What it shows

- **F1 removes every varied-fee stop seen**, and changes no stop turn on the loops.
- **What F1 gives up.** A stream of payments that all land, each at a higher fee, no longer reads as escalation.
  Rule 13's per-transaction fee cap and the fee window still bound it, as they bound any spending that lands.

## Not done yet, and why

- **Building it.** It changes the guard's behaviour while the independent evaluator is testing the guard's state. It
  is built after that run, test-first.
- **Fresh seeds.** Seeds 3003 to 3007 found the problem, so they cannot also confirm the fix. When F1 is built, the
  varied-fee battery is re-run on seeds not used here, before claim S7 changes. That is the rule the first definition
  change followed (`evals/sdk/keel.md`).

## Regenerate

`uv run --script evals/sdk/fee-escalation/run.py`. It prints the table above.
