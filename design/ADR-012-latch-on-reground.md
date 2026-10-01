# ADR-012 · When Keel's REGROUND latches the guard

**Status:** **proposed** on 2026-10-01, for the human to accept or refuse. It answers the first open question in
[docs/SPEC.md](../docs/SPEC.md) §12. Until it is accepted, the guard keeps today's rule.

## Context

- **What the latch is.** The guard's stop until the operator signs a release. It trips:
  - after `latch.afterDenials` consecutive denials;
  - on any denial at Keel's REGROUND posture (SPEC §7).

  While latched, every proposal is denied.
- **What happened.** On devnet, DEMO.md's scene 5, a well-behaved agent re-signing one payment while the first is in
  flight, latched the guard on every run ([e2e/scenes-devnet.md](../evals/e2e/scenes-devnet.md)).
  - **Rule 14** had already denied the re-sign as `intent-in-flight`, rightly: nothing could be paid twice.
  - **Keel** scored the same proposal at repetition 1 and moved to REGROUND, so the guard latched.

  The cockpit's demo record had shown the same thing after an unknown outcome
  ([cockpit/v0.md](../evals/cockpit/v0.md)).
- **Why it matters.** A single early re-sign is ordinary agent behaviour. Solana Agent Kit re-sends on its own
  ([agentkit/sak-devnet.md](../evals/agentkit/sak-devnet.md)). A latch on it stops every later payment, all within
  policy, until a human signs.

## Options

The run of denials latches in every option; they differ only on REGROUND.

| | A REGROUND denial latches … |
|---|---|
| **V0** (today) | always |
| **A** | only when Keel is the reason: the denial is rule 17's `loop-reground` |
| **B** | only when the denial before it was also at REGROUND |
| **C** | when Keel is the reason, or when the denial before it was also at REGROUND (A or B) |

## Evidence

The same proposal streams were run under each option, through a copy of the guard that differs only in the trip rule
([sdk/latch-variants.md](../evals/sdk/latch-variants.md)). The agent there keeps proposing whatever the guard says.

| Stream | V0 | A | B | C |
|---|---|---|---|---|
| identical failing retries | latch at turn 3 | 3 | 4 | 3 |
| rising fees, failing | 4 | 8 | 5 | 5 |
| two shapes alternating | no latch | no latch | no latch | no latch |
| the kit's double signing, 6 payments | 6 (3 of 6 stopped) | 9 (2 of 6) | 9 (2 of 6) | 9 (2 of 6) |
| the same drain, 12 times | 3 | 5 | 4 | 4 |
| 12 different drains | 5 | 5 | 5 | 5 |
| scene 5 after two landed payments, any share of the cap from 10% to 80% | **latch at turn 4; 10 of 13 good payments stopped** | no latch; none stopped | none | none |
| benign, 1,200 payments | no latch | no latch | no latch | no latch |

**In every stream and every option, nothing the policy forbids was allowed.** The drains stay drains denied, and
each failing loop has the same number of allowed attempts. Only the moment of the latch moves.

## Decision (proposed)

**C.** A denial at REGROUND latches the guard when Keel is the reason for it (rule 17), or when the denial just before
it was also at REGROUND. The run of denials latches as today.

- **On pure loops it is as fast as today.** Identical retries latch at turn 3, where Keel itself decides.
- **It tolerates exactly one REGROUND** on a proposal an earlier rule already denied. That is scene 5's re-sign, and
  the kit's second signature. A second one in a row latches.
- **It never admits what a rule forbids.** What C lets through that V0 would not is only proposals that pass every
  policy rule and Keel's own loop check. In the measured streams the latch moves by at most one turn on streams of
  denials, and by three turns on the kit's pattern, during which one more in-policy payment landed.
- **A is weaker than C everywhere it differs:** rising fees latch at 8 against 5, drain storms at 5 against 4. **B**
  is slower than C on pure loops.

## Consequences

- **The code.** The trip rule in `guard.ts`'s `evaluate` changes. "The denial before it" is read from the record (the
  previous decision's `allow` and `posture`), so restore and replay can rebuild it. Nothing new is stored.
- **Replay of old records.** A record made under V0 that latched on a single REGROUND denial would not replay under C:
  the `latch` field would differ at that decision, and `replay` would report a divergence there. The Beta's records
  are local and devnet only, so this is accepted as a one-time break. Records do not yet say which rules made them:
  every entry's `v` is the entry format's version. If records must outlive rule changes, that is a field to add
  before the Alpha.
- **The claims.** S3's stop turns are unchanged: identical retries at turn 3. S12's note that the re-sign scene
  latches the guard is withdrawn once C is built and re-run on devnet.
- **The batteries.** The latch battery adds a case of one REGROUND on an already-denied proposal, which does not latch,
  and one of two in a row, which does. The experiment's streams become a test.
- **Refused, if the human prefers V0:** scene 5 is then shown with its latch and the operator's release, and the open
  question closes as decided.

## Not decided here

- **Runs of failed outcomes** (SPEC §12's second question).
- **Loops that alternate shapes,** which no option stops.

Both are for the Alpha's red team (milestone 3.10).
