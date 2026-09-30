# PROGRESS.md

Coarser than `runs/`. The archivist keeps it current; every phase that ends gets a milestone review in
`kb/milestones/`. **Future work is a sequence of milestones, each reached when its gate passes, never a calendar**
(`docs/ROADMAP.md`). Achieved milestones keep the date they were achieved.

| Milestone | State | Record |
|---|---|---|
| **0 · Setup** | **achieved 2026-09-27**: repo, office, isolation, toolchain, guard, sandbox, private remote, Colosseum draft | `runs/2026-09-27-setup.md` · [review](kb/milestones/2026-09-27_P0-setup.md) |
| **R · Research foundation** | **achieved 2026-09-27**: research on Gubernaut, the governor pattern and Solana DeFAI; `docs/SPEC.md`; ADR-004 to ADR-007; draft-1 papers and submission drafts; the Obsidian knowledge vault and `kb_lint` gate | `runs/2026-09-27-research-foundation.md` · [review](kb/milestones/2026-09-27_R-research.md) |
| **R2 · Verified review and roadmap** | **achieved 2026-09-30**: the docs fact-checked against primary sources; 26 design gaps tested by two independent refuters; `docs/SPEC.md` Draft 2; ADR-008 (proposed) to ADR-011; `docs/PRODUCT.md`, `docs/ROADMAP.md` and `docs/READINESS.md`; every descriptive document refreshed | `runs/2026-09-30-verified-review-roadmap.md` · [review](kb/milestones/2026-09-30_R2-verified-review.md) |
| Leg 1 · Define (1.1) | next: the human's sign-off of `docs/PRODUCT.md` | |
| Leg 2 · Develop: the Beta MVP (2a.1 to 2a.10), QC and verification (2b.1 to 2b.4), the Alpha's scope (2c.1) | after 1.1 | |
| S.1 · Submitted to Colosseum, an external event whose window closes 2026-10-12 at 11:59pm PT | the human's decision, showing whatever has passed its gate | |
| Leg 3 · The Alpha, built and tested hard (3.1 to 3.10) | after Leg 2 | |
| Leg 4 · The live Phantom test with real money (4.1 to 4.5) | only if the human accepts ADR-008, after Leg 3 | |
| Leg 5 · Finish and polish (5.1 to 5.4) | after Leg 4, or after Leg 3 if Leg 4 does not run | |
| Readiness (R.1 to R.5) | after Leg 5 | `docs/READINESS.md` |

## Measured so far

- Retry loop, sensor v0, retries 400 ms apart: stopped at **turn 3** (sandbox and test).
- Drain to an unlisted destination: denied before signing (sandbox, offline and on a local validator).
- Guard: 9/9 tests; boundary guard 34/34; toolchain doctor 12/12; knowledge vault `kb_lint` green.

Nothing about the guard was newly measured in R2. It was a review.

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
3. **The human's:**
   - sign off `docs/PRODUCT.md` (milestone 1.1);
   - decide on ADR-008, the mainnet canary: accept it, change its caps, or decline it; and whether a legal review
     comes first;
   - add `"plansDirectory": "./docs/plans"` to `.claude/settings.json`, and, if ADR-008 is accepted, a read-deny for
     the folder that will hold the canary's agent key;
   - a licence, Apache-2.0 recommended, before the repository goes public;
   - repository access for the judges; the Colosseum fields, videos and submission;
   - a Colosseum Copilot check;
   - sign-off on the milestone reviews and the business plan.
4. **Upstream findings.** U-1 to U-4 are written up for the human (`kb/REGISTRY.md`). U-2 and U-3 are reproduced at
   milestone 2a.7.
5. **No CI yet.** Milestone 2a.1 adds it; the fault injections run by hand until then (`evals/README.md`).
