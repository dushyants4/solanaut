# evals/ — receipts

**Every gate here was shown failing on an injected fault before it was trusted.** A gate never
seen failing might not be checking anything.

| Gate | Shown failing | Then passing | Receipt |
|---|---|---|---|
| `tools/boundary_guard.py --selftest` | 14 territorial cases with a draft policy holding only the secrets rule; then the quoted-redirect case with the full policy | 34/34 | `harness/boundary_guard.md` |
| `npm test` (the guard's first evals, `guard.test.ts`, retired at 2a.5; `sdk/admission.md` maps each one) | 8 of 9 against a stub that allowed everything | 9/9 | `runs/2026-09-27-setup.md` |
| `npm run typecheck` | an injected type error (`maxLamportsPerTx: "one SOL"`) | clean | `runs/2026-09-27-setup.md` |
| `tools/doctor.py` | a wrong pin (solana 4.3.0), and a PATH without the Solana bins | 12/12 | `runs/2026-09-27-setup.md` |
| `tools/lint_plugins.py`, `tools/scaffold.py --check` | inherited from the Office, where their bite job ran in CI | clean | vendored; not re-shown here yet |
| `tools/kb_lint.py` (session-close gate 4) | its own first run (a quoted non-ASCII path); 8 faults at once in a scratch copy; a dangling register row; an orphan through `session_close.py` | 0 errors | `harness/kb_lint.md` |
| CI, `.github/workflows/ci.yml`: the four gates above on every push | four faults on a throwaway branch, one per gate; each failed for its own reason | green on `main` | `ci/safety-net.md` |
| the byte decoder: `packages/sdk/test/decode.test.ts`, `pin-table.test.ts` | 24 of 24 against a stub; then 5 planted decoder bugs and 2 in the pin command, each caught | 35/35 with the guard's 9; 300,000 fuzz inputs, no disagreement with kit | `sdk/decode.md` |
| `tools/doctor.py`, the v1 validator | pointed at the 3.1.10 release | 13/13 | `sdk/decode.md` |
| the instruction classifier: `packages/sdk/test/classify.test.ts` | 24 of 25 against a stub, and rule 6's test before its field existed; then 10 planted bugs, each caught | 61/61 in `npm test` | `sdk/classify.md` |
| policy v1: `packages/sdk/test/policy.test.ts` | 12 of 12 against a stub; then 8 planted bugs, 7 caught until a known-answer hash test caught the eighth | 13/13 | `sdk/policy.md` |
| admission: `packages/sdk/test/admission.test.ts` | 31 of 31 against a stub; then 12 planted bugs: 8 caught, 3 more once boundary tests were added, 1 equivalent | 33/33; `npm test` 98/98; the sandbox on a local validator | `sdk/admission.md` |
| durable state: `packages/sdk/test/durable.test.ts` | 8 of 9 against stubs; the latch test once its drains stopped looking like a loop; then 8 planted bugs: 6 caught, fsync untestable here, 1 equivalent | 11/11, the restart battery's 20 SIGKILLs included; `npm test` 109/109 | `sdk/durable.md` |
| Keel hardened and sensor v1: `keel.test.ts`, `sensor.battery.test.ts` | 8 of 10 against stubs (2 upstream reproductions pass); the benign battery's first run found a defect in both sensors; 5 planted bugs, 4 caught, the fifth after a through-the-guard test | 12/12 and 2/2; benign on fresh seeds: v1 0 of 1,200 stopped; `npm test` 123/123 | `sdk/keel.md` |

CI runs the gates on every push since milestone 2a.1 (`ci/safety-net.md`). Still owed: a job that re-runs the fault
injections on every push (the Office's `bite` job), with the thresholds in `docs/READINESS.md`, at milestone 3.9. The Beta batteries are specified in `docs/SPEC.md` §11.
