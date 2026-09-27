# PROGRESS.md

Coarser than `runs/`. The archivist keeps it current.

| Phase | State | Record |
|---|---|---|
| **0 · Setup** | **done 2026-09-27**: repo, office, isolation, toolchain, guard, sandbox, private remote, Colosseum draft | `runs/2026-09-27-setup.md` |
| H1 · Guard (sensor v1, presets, batteries) | next, Sep 28 – Oct 1 | |
| H2 · Adapters (ElizaOS, AgentKit) | Oct 2 – 4 | |
| H3 · On-chain vault (devnet) | Oct 5 – 7 | |
| H4 · Cockpit and adversarial battery | Oct 8 – 10 | |
| H5 · Submission (the human's) | Oct 11 – 12, 11:59pm PT | |

## Measured so far

- Retry loop, sensor v0, retries 400 ms apart: stopped at **turn 3** (sandbox and test).
- Drain to an unlisted destination: denied before signing (sandbox, offline and local validator).
- Guard: 9/9 tests; boundary guard 34/34; toolchain doctor 12/12.

## Open

- Sensor v0 on a real clock reads fast legitimate payments as full intensity (still allowed).
  H1 measures and fixes it.
- No CI yet; the fault injections are run by hand (`evals/README.md`).
- Licence, entity, making the repo public: the human's.
