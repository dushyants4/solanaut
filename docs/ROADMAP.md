# ROADMAP.md — the parlay: five legs, won by achievement

> **Draft 3** · 2026-10-05 · owner: archivist, drafted with the architect · for: the human, every seat, and judges ·
> not public. **Milestones, not dates:** each milestone is reached when its gate passes, never by a calendar, at the
> human's instruction of 2026-09-30. Specs: `docs/SPEC.md`. Tests and certification: `docs/READINESS.md`.
> Register: `kb/DOCUMENTS.md`.

## How the parlay works

- **Five legs, in order:** define, develop, test hard, go live, polish. Then Readiness, which turns the product into a
  certified release.
- **A leg is won only when every milestone in it is achieved.** The next leg starts after that, never before.
- **Inside a leg, milestones run in parallel** wherever their dependencies allow.
- **A failed gate busts the leg back to the milestone that failed**, never forward. Nothing is skipped, and no gate is
  weakened to pass (`workflows/eval_battery.md`).
- **Every milestone states three things:** what must be true when it is achieved, what it depends on, and the evidence
  that proves it. Evidence is a receipt in `evals/`, a run record in `runs/`, or a signed-off document.
- **The bet pays out** as a 1.0 release whose every readiness item has its evidence.

## External dates are facts, not the plan

Colosseum's submission window closes at 11:59pm PT on 2026-10-12 (`docs/HACKATHON.md`). That date is a fact about the
contest, not a milestone. The rule for it:

> **When the human decides to submit, the submission shows exactly the milestones that have passed their gates.**
> Anything not yet achieved is described as "being built", and nothing unmeasured is claimed (`docs/CLAIMS.md`).

The build order in Leg 2 puts first what matters most, so whatever is achieved when the human submits is the most
valuable subset.

## Leg 1 · Define

| Milestone | Achieved when | Depends on | Evidence |
|---|---|---|---|
| 1.1 · The product is defined | `docs/PRODUCT.md` states why, what, how, for whom, what it is not and how success is measured; every factual sentence traces to a `docs/CLAIMS.md` row and every design sentence is marked; the human signs it off | the verified review, done 2026-09-30 | the human's sign-off, recorded in a run record |

**Busts when** the human rejects the definition. Then revise it and ask again.

**Achieved 2026-09-30:** the human signed off `docs/PRODUCT.md` (`runs/2026-10-01-beta-build.md`). Leg 1 is won.

## Leg 2 · Develop

### 2a · The Beta MVP, built

The Beta MVP is the *minimum* viable product: the guard v1 that `docs/SPEC.md` Draft 2 specifies, two adapters, the
on-chain bound on devnet, and a first dashboard.

| Milestone | Achieved when | Depends on | Evidence |
|---|---|---|---|
| 2a.1 · Safety net | a CI job runs `npm test`, the typecheck, the boundary self-test and `kb_lint` on every push, and was seen failing on an injected fault | 1.1 | an `evals/` receipt |
| 2a.2 · Bytes decoded | legacy, v0 with pinned tables, and v1 decode to effects without `@solana/web3.js`; unknown versions deny; a fuzz harness runs; decoded effects match `@solana/kit`'s codecs on a golden set; a command prints a table pin | 2a.1 | tests seen failing first; the golden-set report |
| 2a.3 · Instructions classified | the allowlist per instruction for System, SPL Token, Token-2022, ComputeBudget and Memo; the nonce and other-signer denials; the fee rule, with defaults, v1's config, base fees and tips | 2a.2 | a failing-first test per rule |
| 2a.4 · Policy v1 | validated at creation (rule 0), deep-frozen and hashed; the principal; pinned tables; defects D1, D2 and D9 closed | 2a.1 | tests seen failing first |
| 2a.5 · Admission | rules 0 to 19 in order; receipts; intents keyed by effects; the latch with its structured release message; defects D5, D6, D7 and D10 closed | 2a.3, 2a.4 | tests seen failing first |
| 2a.6 · Durable state | the hash-chained log synced before each answer; restore by replay on start; one writer per identity; `replay()`; defect D11 closed | 2a.5 | the restart battery |
| 2a.7 · Keel hardened | the controller's bytes hashed (D4); telemetry validated before each tick (D3); sensor v1 (D8); defect D12 closed | 2a.5 | tests seen failing first; upstream findings U-2 and U-3 reproduced or refuted |
| 2a.8 · Adapters | `guardedWallet` with exactly its five members and a comparison after signing; the kit partial signer; `SolanautDenied`; the same verdicts as the SDK | 2a.5 | the adapters battery |
| 2a.9 · The on-chain bound | on devnet: a controlled Squads v4 multisig with an operator key as config authority; the agent's key named only on the spending limit; destinations set; a stolen-key script refused past the limit; the revoke timed | 2a.1 | a run record with the signatures and the revoke time |
| 2a.10 · Dashboard v0 | on localhost: live decisions from the log, spend against caps, intents, the latch and the Squads limit remaining; every chain read opts in to v1 | 2a.6, 2a.9 | a screenshot and a run record |

**Build order, most valuable first.** If the human submits before every Beta milestone is achieved, this order decides
what the submission can show:
1. 2a.1; 2a.2 for legacy and v0; 2a.3; 2a.4; 2a.5. This is the drain story.
2. 2a.6, the restart story, which the lost-state incident [M4] makes central.
3. 2a.8 for Solana Agent Kit, then 2a.9: one-line adoption, and the on-chain bound.
4. 2a.7, then 2a.10: loops, and the dashboard.
5. Last: v1 decoding, the kit wrapper, sensor v1, Token-2022 beyond TransferChecked, and Phantom operator actions in
   the dashboard.

**Never dropped, whatever the timing:** fail-closed, the nonce denial, the instruction-level deny, receipts, intents,
restore on start, and the claims discipline.

### 2b · QC, validation and verification

| Milestone | Achieved when | Depends on | Evidence |
|---|---|---|---|
| 2b.1 · Verified | every Beta battery in `docs/SPEC.md` §11 passes from a clean clone, run by the evaluator seat; each new gate was seen failing on an injected fault | 2a.2 to 2a.10 | `evals/` receipts |
| 2b.2 · Claims current | every measured number has a `docs/CLAIMS.md` row with its version, config and the command that regenerates it | 2b.1 | the diff of `docs/CLAIMS.md` |
| 2b.3 · Validated | the demo script runs end to end on devnet, with the local-validator fallback; a scripted Solana Agent Kit agent is governed by a one-line change | 2b.1 | a run record, and the recorded dry run |
| 2b.4 · Reviewed | the Beta milestone review is written (`workflows/milestone_review.md`) and the human signs it off | 2b.1 to 2b.3 | `kb/milestones/`, and a `milestone/beta` tag |

### The submission, an external event

| Milestone | Achieved when | Depends on | Evidence |
|---|---|---|---|
| S.1 · Submitted | README, pitch and demo videos recorded only from achieved milestones, the prior-work disclosure, and repository access; submitted by the human (T4), who set it, the licence and the judges' access aside until testing is done (2026-09-30) | whatever has passed its gate when the human decides to submit | the Colosseum page, and a run record |

### 2c · The Alpha, scoped

The Alpha MVP is the *maximum* viable product: everything a team needs to run an agent with real funds behind
Solanaut.

| Milestone | Achieved when | Depends on | Evidence |
|---|---|---|---|
| 2c.1 · Alpha scope accepted | ADRs for the Alpha; `docs/SPEC.md` for the Alpha, with requirement IDs; the test plan in `docs/READINESS.md` confirmed; a risk register; the human approves the scope | 2b.4 | the approved documents |

**Leg 2 busts when** a drain-shaped or fail-closed case is admitted, or a gate cannot be shown failing first.

**Achieved 2026-10-05:** the human signed off the Beta review (2b.4, tagged `milestone/beta`) and approved the Alpha's
scope (2c.1): `docs/SPEC.md` §13, ADR-013 to ADR-018, `docs/RISKS.md` and the thresholds in `docs/READINESS.md`, and
accepted ADR-012's option C. With 2a.1 to 2b.3 achieved earlier, **Leg 2 is won.** Leg 3 is built next, by Codex under
`AGENTS.md` (`docs/HANDOFF.md`).

## Leg 3 · The Alpha, built and tested hard

| Milestone | Achieved when | Depends on | Evidence |
|---|---|---|---|
| 3.1 · Signer process | `solanaut-signer` holds the key; it stamps time and fetches heights, blockhash validity, outcomes and unpinned tables itself; one writer; restore on start | 2c.1 | tests seen failing first |
| 3.2 · Operator-signed policy | a guard loads only a policy whose hash the operator's key signed | 3.1 | tests seen failing first |
| 3.3 · Token-2022 and token accounts | the extension set pinned, and mutable settings re-read at admission; TransferCheckedWithFee decoded; ATA creation decoded, with its rent counted | 3.1 | tests seen failing first |
| 3.4 · Opaque programs bounded | simulation on the operator's RPC; Lighthouse assertions appended on every principal-controlled account, covering balances and authorities; the receipt bound to the modified bytes | 3.1 | a Jupiter route bounded on a Surfpool mainnet fork |
| 3.5 · Phantom paths | over-cap proposals escalated for the operator to co-sign in Phantom, passing the narrow Lighthouse rule; an MCP firewall in front of Phantom's agent wallet on devnet, run under a separate OS user and funded only through the limit | 3.1, 3.4 | devnet run records |
| 3.6 · ElizaOS plugin | the guard inside `plugin-solana`'s signing path, with the same verdicts as the SDK | 2c.1 | the adapters battery |
| 3.7 · Log anchor | `solanaut_anchor` anchors the log's head on devnet, with a verified build and `security.txt` | 2c.1 | the verification result |
| 3.8 · Dashboard v1 | a fleet view, alerts, and operator actions through Phantom signatures | 2a.10, 3.5 | screenshots and a run record |
| 3.9 · CI hardened | fault-injection jobs, and the coverage, mutation, property, fuzz, differential and performance gates in `docs/READINESS.md` | 2a.1 | CI runs, each gate seen failing first |
| 3.10 · Tested hard | every Leg 3 threshold in `docs/READINESS.md` is met; the red team is done; threat model v3 is reviewed; no critical or high finding is open | 3.1 to 3.9 | receipts, and the Alpha milestone review |

**Busts when** any threshold misses, or a critical or high finding stays open.

## Leg 4 · The live Phantom test

**On 2026-09-30 the human chose devnet only, for now.** Leg 4 therefore runs on devnet first, after the Alpha is
ready, with the human's Phantom wallet in its Chrome extension as the operator. Real money comes only if the human
later accepts `design/ADR-008-mainnet-canary.md`, and every real-funds step is then the human's (T4).

| Milestone | Achieved when | Depends on | Evidence |
|---|---|---|---|
| 4.1 · Decision | the human chooses the network and the wallet: devnet with the human's Phantom wallet (chosen for now on 2026-09-30), or ADR-008's mainnet canary with its caps and, if wanted, a legal review first | 3.10 | ADR-008's status line, and a run record |
| 4.2 · Rehearsed | the exact runbook passes twice on devnet, including the revoke drill | 4.1 | two run records |
| 4.3 · Pre-flight | program ids re-verified; Alpenglow's status and the commitment assumptions checked, and no timeout assumes 400 ms slots; at least two RPC providers; caps set; recording set up so no seed phrase or key can appear | 4.2 | the signed checklist |
| 4.4 · The live test | on the chosen network, every scenario below gives its expected verdict and on-chain result, and every lamport reconciles; sessions recorded | 4.3 | the recordings, signatures and reconciliation |
| 4.5 · Closed | the live-test report in `runs/`; `docs/CLAIMS.md` rows scoped to its amounts, date and versions; the limit revoked, the funds swept and the agent key deleted | 4.4 | the report |

**The scenarios for 4.4:**
- a benign payment lands;
- a drain, an approval, a durable-nonce proposal and an early re-sign are each denied before signing;
- a retry loop is stopped;
- a v1 transaction is decoded and capped;
- the stolen-key script is refused by Squads on the chosen network;
- an over-cap payment escalates, the human co-signs it in Phantom, and Phantom's Lighthouse additions pass the narrow
  rule;
- the latch is released from Phantom;
- the limit is revoked, and the next use fails.

**Busts when** any lamport fails to reconcile, the guard errors other than by a fail-closed denial, or the RPC is
unstable. Then stop, revoke, sweep, and return to 4.2.

## Leg 5 · Finish and polish

| Milestone | Achieved when | Depends on | Evidence |
|---|---|---|---|
| 5.1 · Dashboard 1.0 | the panels below; read-only by default; operator actions only through Phantom signatures; WCAG 2.2 AA; each decision shown within a second | 3.8, and 4.5 if Leg 4 ran | screenshots, and the accessibility report |
| 5.2 · Developer experience | a quickstart; examples for Solana Agent Kit, kit and MCP; documented presets; an API reference; an error catalogue that gives each rule's remedy | 3.10 | the docs |
| 5.3 · Packaging | `@solanaut/sdk`, the signer and the MCP firewall prepared as version 0.9.0; publishing is the human's (T4) | 5.2 | the prepared publish command |
| 5.4 · Usability | at least 3 developers from outside the project reach a first guarded transaction in a median of 15 minutes or less; at least 90% of their tasks succeed; an automated accessibility scan finds nothing serious; the human signs off | 5.1 to 5.3 | the study notes and the scan |

| Dashboard panel | Shows |
|---|---|
| health | guard identity, policy hash, Keel verification, the latch, the posture |
| decisions | the live stream, with verdict, rule and reason |
| spend | window gauges for SOL, each mint, fees and rent |
| intents | attempts in flight, and their expiry heights |
| chain | landing rate, confirmation time, and the Squads limit remaining |
| performance | decision latency at p50 and p99, and log write latency |
| integrity | the chain verified, replay divergences, the last anchor |

**Busts when** a usability or accessibility threshold misses.

## Readiness

The certification track is in `docs/READINESS.md`: milestones R.1, a release candidate; R.2, an independent audit;
R.3, a bug bounty and disclosure; R.4, general availability of 1.0; and R.5, operation. Each has entry and exit
criteria and its evidence.

## Naming

Inside the project, "Beta MVP" means the minimum viable product and "Alpha MVP" the maximum, as the human named them.
Public version numbers use semver, because readers expect an alpha before a beta: 0.1 for the Beta MVP, 0.9 for the
Alpha MVP, then a 1.0.0 release candidate and 1.0.0.

## Changes

| Version | Date | What changed |
|---|---|---|
| Draft 1 | 2026-09-30 | First draft: the five-leg parlay, built on achievement-based milestones at the human's instruction. |
| Draft 2 | 2026-09-30 | Leg 1 achieved. Leg 4 runs on devnet with the human's Phantom wallet first; real money waits for ADR-008. The submission, the licence and the judges' access wait until testing is done. |
| Draft 3 | 2026-10-05 | Leg 2 won: the Beta review signed off (2b.4) and the Alpha's scope approved (2c.1). Leg 3 is handed to Codex (`AGENTS.md`, `docs/HANDOFF.md`). |
