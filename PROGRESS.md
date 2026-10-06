# PROGRESS.md

Coarser than `runs/`. The archivist keeps it current; every phase that ends gets a milestone review in
`kb/milestones/`. **Future work is a sequence of milestones, each reached when its gate passes, never a calendar**
(`docs/ROADMAP.md`). Achieved milestones keep the date they were achieved.

| Milestone | State | Record |
|---|---|---|
| **0 · Setup** | **achieved 2026-09-27**: repo, office, isolation, toolchain, guard, sandbox, private remote, Colosseum draft | `runs/2026-09-27-setup.md` · [review](kb/milestones/2026-09-27_P0-setup.md) |
| **R · Research foundation** | **achieved 2026-09-27**: research on Gubernaut, the governor pattern and Solana DeFAI; `docs/SPEC.md`; ADR-004 to ADR-007; draft-1 papers and submission drafts; the Obsidian knowledge vault and `kb_lint` gate | `runs/2026-09-27-research-foundation.md` · [review](kb/milestones/2026-09-27_R-research.md) |
| **R2 · Verified review and roadmap** | **achieved 2026-09-30**: the docs fact-checked against primary sources; 26 design gaps tested by two independent refuters; `docs/SPEC.md` Draft 2; ADR-008 (proposed) to ADR-011; `docs/PRODUCT.md`, `docs/ROADMAP.md` and `docs/READINESS.md`; every descriptive document refreshed | `runs/2026-09-30-verified-review-roadmap.md` · [review](kb/milestones/2026-09-30_R2-verified-review.md) |
| **Leg 1 · Define (1.1)** | **achieved 2026-09-30**: the human signed off `docs/PRODUCT.md` | `runs/2026-10-01-beta-build.md` |
| **Leg 2 · Develop**: the Beta MVP (2a.1 to 2a.10), QC and verification (2b.1 to 2b.4), the Alpha's scope (2c.1) | **achieved 2026-10-05**, when the human signed off the Beta review (2b.4, tagged `milestone/beta`) and approved the Alpha's scope (2c.1). Achieved: **2a.1** safety net (CI, shown failing first), **2a.2** bytes decoded (legacy, v0 with pins, v1; no web3.js), **2a.3** instructions classified (an allowlist per instruction; nonce and other-signer facts; the fee rule), **2a.4** policy v1 (rule 0, frozen, hashed), **2a.5** admission (rules 0 to 19 in order; receipts; intents; the latch; D1, D2, D5, D6, D7, D9, D10 and D12 closed), **2a.6** durable state (the record synced before each answer; restore by replay; one writer; `replay()`; D11 closed), **2a.7** Keel hardened (bytes hashed; telemetry checked; sensor v1, measured; U-2 and U-3 reproduced; D3, D4, D8 closed), **2a.8** adapters (`guardedWallet` for Solana Agent Kit, `guardedSigner` for kit, `SolanautDenied`; the same verdicts as the SDK). **2a.9** the on-chain bound, on devnet (2026-10-01, once the human funded the operator): Squads v4's program refused the stolen key past the limit, to an unlisted address, and after the revoke, which landed 3 slots after its send. **2a.10** the cockpit on devnet: the scenes' record, latches and releases marked, the Squads limit with the program's errors named. **2b.3** validated: the demo's scenes end to end on devnet with the local fallback (a real SIGKILL and restore; replay 0 divergences), and the Solana Agent Kit agent on devnet with the same verdicts as locally. **2b.1**: 11 of 11 §11 batteries pass, nine from a clean clone and two on devnet; **the independent evaluator run is done** (`evals/independent/`): three black-box evaluators, 317 cases, six defects (D15 to D20) closed test-first, and claim S7 scoped to constant fees. **2b.2** claims current: every measured row names its regenerating command, gated by `tools/claims_lint.py` (`evals/harness/claims_lint.md`). **2b.4** the Beta review (`kb/milestones/2026-10-01_2b-beta.md`), signed off by the human on 2026-10-05. **2c.1** the Alpha's scope, approved by the human on 2026-10-05: `docs/SPEC.md` §13 (requirements with IDs), ADR-013 to ADR-018 accepted, `docs/RISKS.md` 1.0, and the thresholds in `docs/READINESS.md` 2.0; ADR-012's option C accepted the same day | `runs/2026-10-01-beta-build.md` · `runs/2026-10-01-devnet.md` · `evals/ci/safety-net.md` · `evals/sdk/decode.md` · `evals/sdk/classify.md` · `evals/sdk/policy.md` · `evals/sdk/admission.md` · `evals/sdk/durable.md` · `evals/sdk/keel.md` · `evals/sdk/adapters.md` · `evals/onchain/squads-local.md` · `evals/onchain/squads-devnet.md` · `evals/cockpit/v0.md` · `evals/e2e/scenes-devnet.md` · `evals/verify/beta-gate.md` · `evals/agentkit/sak-local.md` · `evals/agentkit/sak-devnet.md` |
| S.1 · Submitted to Colosseum, an external event whose window closes 2026-10-12 at 11:59pm PT | the human's decision, showing whatever has passed its gate | |
| Leg 3 · The Alpha, built and tested hard (3.1 to 3.10) | **in progress**: handed to Codex on 2026-10-05, under `AGENTS.md`, with the work queue in `docs/HANDOFF.md`. Claude returns to review, run the independent red team, and finalise | `runs/2026-10-05-handoff-to-codex.md` · `docs/HANDOFF.md` |
| Leg 4 · The live Phantom test (4.1 to 4.5) | after Leg 3: on devnet with the human's Phantom wallet, as the human chose on 2026-09-30; real money only if the human later accepts ADR-008 | |
| Leg 5 · Finish and polish (5.1 to 5.4) | after Leg 4, or after Leg 3 if Leg 4 does not run | |
| Readiness (R.1 to R.5) | after Leg 5 | `docs/READINESS.md` |

## Measured so far

- Retry loop, sensor v0, retries 400 ms apart: stopped at **turn 3** (sandbox and test).
- Drain to an unlisted destination: denied before signing (sandbox, offline and on a local validator).
- Guard: 9/9 tests; boundary guard 34/34, and 59/59 since Codex's harness (2026-10-05,
  `evals/harness/boundary_guard.md`); toolchain doctor 13/13; knowledge vault `kb_lint` green.
- Byte decoder (2a.2): 300 kit-built messages and their resolved accounts match kit exactly; 300,000 fuzz inputs, no
  disagreement with kit and no error other than a named rule; 5 of 5 planted bugs caught (`evals/sdk/decode.md`).
- Classifier (2a.3): every Token and ComputeBudget discriminator, and System's, named as the Solana program clients
  name them; 10 of 10 planted bugs caught (`evals/sdk/classify.md`).
- Restart battery (2a.6): SIGKILLed at 20 random points, the guard's record ended identical, hash for hash, to an
  uninterrupted run, and replayed without divergence (`evals/sdk/durable.md`).
- Sensor v1 (2a.7), synthetic streams at a constant priority fee: 0 of 600 benign payments stopped at the expected
  rate, 0 of 600 in bursts (95% upper bound 0.64% each), against 82.8% and 21.7% for sensor v0. With varied fees, the
  independent evaluator measured 15 of 3,000 stopped (0.50%), each latching the guard (`evals/independent/e3-edges/`);
  after sensor v1's second definition change, 0 of 3,000 on fresh seeds (`evals/sdk/fee-escalation.md`); identical failing retries stopped at turn 3; a
  loop alternating two shapes not stopped in 12 turns, an open question (`evals/sdk/keel.md`).
- Drain battery (2b.1): 40 transactions shaped like the threat model's drains, each denied before signing by its named
  rule (`evals/verify/beta-gate.md`).
- CI (2a.1): four gates on every push, each seen failing on its own injected fault (`evals/ci/safety-net.md`).
- On devnet (2a.9, 2a.10, 2b.1, 2b.3), all on 2026-10-01:
  - **The stolen-key drill:** Squads v4's program refused the agent's key past the limit, to an unlisted address, and
    after the revoke. The revoke landed 3 slots after its send (`evals/onchain/squads-devnet.md`).
  - **The demo's scenes:** 5 payments landed and 8 proposals were refused before signing, by their named rules. A
    SIGKILLed guard restored from its record with replay 0 divergences. The re-sign scene and the loop each latched the
    guard, and the operator released it (`evals/e2e/scenes-devnet.md`).
  - **Solana Agent Kit:** the same verdicts as on a local validator. Unguarded, the kit reported its three landed
    payments as failed (`evals/agentkit/sak-devnet.md`).


## Open

**Solanaut 1.0 mission:** `docs/plans/2026-10-05_solanaut-1.md`, approved in this session.
ADR-012 C is implemented and verified offline (`evals/sdk/latch-c.md`); its complete queue item
still owes a funded devnet rerun. Historical records' accepted replay differences are enumerated.
ADR-019/020 are proposed clarifications awaiting the human; the isolated signer is not built.
The Alpha and stable-release gates are not achieved by this initial work.

1. **Defects** (`docs/SPEC.md` §10):
   - D1 to D12 are closed: D1, D2, D5, D6, D7, D9, D10 and D12 at 2a.5, D11 at 2a.6, D3, D4 and D8 at 2a.7.
   - D13, found and closed before devnet: a send of unknown fate was reported `failed`.
   - D14, found after the devnet runs and closed test-first (`evals/sdk/intents-d14.md`). An unreported attempt
     past its last valid height had counted as one that never landed. Now it holds its intent until reported, and
     `guardedWallet` follows up what it signed.
   - D15 to D20, found by the independent evaluator run on 2026-10-03 and closed test-first (`evals/independent/`):
     signed bytes released as never signed (D15); a decision on a denial (D16); a release the record did not verify
     (D17); a released receipt that still redeemed (D18); a release's expiry on the caller's clock (D19); a short
     window that let an attempt still able to land leave the cap (D20).
2. **Loops that change shape.** A loop alternating two shapes with a changing amount is not stopped by Keel; the fee
   window and the INHIBIT clamp bound it. An open question for the Alpha's red team (`docs/SPEC.md` §12).
   **Latching on a denied retry** is the other. DEMO.md's re-sign scene latches the guard on every run on devnet.
   - **Measured:** four trip rules, offline (`evals/sdk/latch-variants.md`). None admits a forbidden proposal. Today's
     rule stops the 10 good payments after the re-sign.
   - **ADR-012, accepted by the human on 2026-10-05 (option C):** a REGROUND denial latches when Keel is the reason,
     or when the denial before it was also at REGROUND. Built and verified offline in `evals/sdk/latch-c.md`;
     the funded devnet rerun is still owed. The remaining loop questions stay open.
3. **The human's**, as decided on 2026-09-30:
   - `docs/PRODUCT.md` is signed off, and `"plansDirectory": "./docs/plans"` is in `.claude/settings.json`, done by
     the agent at the human's direction;
   - ADR-008 is deferred: devnet only for now. The human connects Phantom's Chrome extension for Leg 4, after the
     Alpha;
   - set aside until testing is done: the licence, the judges' repository access, the Colosseum fields, videos and
     submission, and the Copilot check. This seat's work is development;
   - still open: sign-off on the earlier milestone reviews and the business plan;
   - **decided on 2026-10-05:** the Beta review signed off (2b.4); the Alpha's scope approved (2c.1: SPEC §13,
     ADR-013 to ADR-018, the risk register, the thresholds); ADR-012's option C accepted. Leg 3 is handed to Codex.
4. **Upstream findings.** U-1 to U-4 are written up for the human (`kb/REGISTRY.md`). U-2 and U-3 are reproduced at
   milestone 2a.7.
5. **CI runs the gates, not yet the fault injections.** The `bite` job that re-runs them on every push is owed at
   milestone 3.9 (`evals/README.md`).
