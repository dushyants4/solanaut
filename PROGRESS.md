# PROGRESS.md

Coarser than `runs/`. The archivist keeps it current; every phase that ends gets a milestone review in
`kb/milestones/`. **Future work is a sequence of milestones, each reached when its gate passes, never a calendar**
(`docs/ROADMAP.md`). Achieved milestones keep the date they were achieved.

| Milestone | State | Record |
|---|---|---|
| **0 · Setup** | **achieved 2026-09-27**: repo, office, isolation, toolchain, guard, sandbox, private remote, Colosseum draft | `runs/2026-09-27-setup.md` · [review](kb/milestones/2026-09-27_P0-setup.md) |
| **R · Research foundation** | **achieved 2026-09-27**: research on Gubernaut, the governor pattern and Solana DeFAI; `docs/SPEC.md`; ADR-004 to ADR-007; draft-1 papers and submission drafts; the Obsidian knowledge vault and `kb_lint` gate | `runs/2026-09-27-research-foundation.md` · [review](kb/milestones/2026-09-27_R-research.md) |
| **R2 · Verified review and roadmap** | **achieved 2026-09-30**: the docs fact-checked against primary sources; 26 design gaps tested by two independent refuters; `docs/SPEC.md` Draft 2; ADR-008 (proposed) to ADR-011; `docs/PRODUCT.md`, `docs/ROADMAP.md` and `docs/READINESS.md`; every descriptive document refreshed | `runs/2026-09-30-verified-review-roadmap.md` · [review](kb/milestones/2026-09-30_R2-verified-review.md) |
| **Leg 1 · Define (1.1)** | **achieved 2026-09-30**: the human signed off `docs/PRODUCT.md` | `runs/2026-09-30-beta-build.md` |
| Leg 2 · Develop: the Beta MVP (2a.1 to 2a.10), QC and verification (2b.1 to 2b.4), the Alpha's scope (2c.1) | **in progress**, in the build order of `docs/ROADMAP.md`. Achieved: **2a.1** safety net (CI, shown failing first), **2a.2** bytes decoded (legacy, v0 with pins, v1; no web3.js) | `runs/2026-09-30-beta-build.md` · `evals/ci/safety-net.md` · `evals/sdk/decode.md` |
| S.1 · Submitted to Colosseum, an external event whose window closes 2026-10-12 at 11:59pm PT | the human's decision, showing whatever has passed its gate | |
| Leg 3 · The Alpha, built and tested hard (3.1 to 3.10) | after Leg 2 | |
| Leg 4 · The live Phantom test (4.1 to 4.5) | after Leg 3: on devnet with the human's Phantom wallet, as the human chose on 2026-09-30; real money only if the human later accepts ADR-008 | |
| Leg 5 · Finish and polish (5.1 to 5.4) | after Leg 4, or after Leg 3 if Leg 4 does not run | |
| Readiness (R.1 to R.5) | after Leg 5 | `docs/READINESS.md` |

## Measured so far

- Retry loop, sensor v0, retries 400 ms apart: stopped at **turn 3** (sandbox and test).
- Drain to an unlisted destination: denied before signing (sandbox, offline and on a local validator).
- Guard: 9/9 tests; boundary guard 34/34; toolchain doctor 13/13; knowledge vault `kb_lint` green.
- Byte decoder (2a.2): 300 kit-built messages and their resolved accounts match kit exactly; 300,000 fuzz inputs, no
  disagreement with kit and no error other than a named rule; 5 of 5 planted bugs caught (`evals/sdk/decode.md`).
- CI (2a.1): four gates on every push, each seen failing on its own injected fault (`evals/ci/safety-net.md`).


## Open

1. **The defects.** D1 to D12 in the current guard (`docs/SPEC.md` §10), notably:
   - D1: `guard.policy` is mutable;
   - D2: the policy is not validated;
   - D4: the Keel digest compares two constants;
   - D10: System instructions other than Transfer pass with nothing counted;
   - D11: the guard's state lives in memory, so a restart resets its caps.

   Milestones 2a.4 to 2a.7 fix them test-first.
2. **Sensor v0.** On a real clock it reads fast legitimate payments as full intensity (D8). Milestone 2a.7 measures
   it and fixes it.
3. **The human's**, as decided on 2026-09-30:
   - `docs/PRODUCT.md` is signed off, and `"plansDirectory": "./docs/plans"` is in `.claude/settings.json`, done by
     the agent at the human's direction;
   - ADR-008 is deferred: devnet only for now. The human connects Phantom's Chrome extension for Leg 4, after the
     Alpha;
   - set aside until testing is done: the licence, the judges' repository access, the Colosseum fields, videos and
     submission, and the Copilot check. This seat's work is development;
   - still open: sign-off on the milestone reviews and the business plan.
4. **Upstream findings.** U-1 to U-4 are written up for the human (`kb/REGISTRY.md`). U-2 and U-3 are reproduced at
   milestone 2a.7.
5. **CI runs the gates, not yet the fault injections.** The `bite` job that re-runs them on every push is owed at
   milestone 3.9 (`evals/README.md`).
