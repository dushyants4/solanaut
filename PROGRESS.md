# PROGRESS.md

Coarser than `runs/`. The archivist keeps it current; every phase that ends gets a milestone review in
`kb/milestones/`.

| Phase | State | Record |
|---|---|---|
| **0 · Setup** | **done 2026-09-27**: repo, office, isolation, toolchain, guard, sandbox, private remote, Colosseum draft | `runs/2026-09-27-setup.md` · [review](kb/milestones/2026-09-27_P0-setup.md) |
| **R · Research foundation** | **done 2026-09-27**: research on Gubernaut, the governor pattern and Solana DeFAI; `docs/SPEC.md`; ADR-004 to ADR-007; draft-1 papers and submission drafts; the Obsidian knowledge vault and `kb_lint` gate | `runs/2026-09-27-research-foundation.md` · [review](kb/milestones/2026-09-27_R-research.md) |
| H1 · Guard v1 (defects D1–D9 first, then `docs/SPEC.md`) | next, Sep 28 – Oct 1 | |
| H2 · Adapters (Solana Agent Kit, `@solana/kit`; P1: ElizaOS, signer process) | Oct 2 – 4 | |
| H3 · On-chain (a Squads v4 spending limit on devnet; P2: `solanaut_anchor`) | Oct 5 – 7 | |
| H4 · Cockpit and adversarial battery | Oct 8 – 10 | |
| H5 · Submission (the human's) | Oct 11 – 12, 11:59pm PT | |

## Measured so far

- Retry loop, sensor v0, retries 400 ms apart: stopped at **turn 3** (sandbox and test).
- Drain to an unlisted destination: denied before signing (sandbox, offline and on a local validator).
- Guard: 9/9 tests; boundary guard 34/34; toolchain doctor 12/12; knowledge vault `kb_lint` green.

## Open

1. **The defects.** D1–D9 in the current guard (`docs/SPEC.md` §10), notably:
   - D1: `guard.policy` is mutable;
   - D2: the policy is not validated;
   - D4: the Keel digest compares two constants.

   H1 fixes them test-first.
2. **Sensor v0.** On a real clock it reads fast legitimate payments as full intensity (D8). H1 measures
   it and fixes it.
3. **The human's:**
   - add `"plansDirectory": "./docs/plans"` to `.claude/settings.json` (plan mode is blocked until
     then);
   - a licence;
   - repository access for the judges;
   - the Colosseum fields, videos and submission;
   - a Colosseum Copilot check;
   - sign-off on the milestone reviews and the business plan.
4. **Upstream findings.** U-1 to U-4 are written up for the human (`kb/REGISTRY.md`). U-2 and U-3 are to
   be reproduced in H1.
5. **No CI yet.** The fault injections are run by hand (`evals/README.md`).
