# evals/ — receipts

**Every gate here was shown failing on an injected fault before it was trusted.** A gate never
seen failing might not be checking anything.

| Gate | Shown failing | Then passing | Receipt |
|---|---|---|---|
| `tools/boundary_guard.py --selftest` | 14 territorial cases with a draft policy holding only the secrets rule; then the quoted-redirect case with the full policy. For Codex (2026-10-05): 18 cases (its patches, shell reads, the law it may not edit), all failing first; then `2>&1` counted as a write, found by using it | 34/34; then 59/59, and 11 Codex-shaped payloads through the hook's exact command | `harness/boundary_guard.md` |
| `npm test` (the guard's first evals, `guard.test.ts`, retired at 2a.5; `sdk/admission.md` maps each one) | 8 of 9 against a stub that allowed everything | 9/9 | `runs/2026-09-27-setup.md` |
| `npm run typecheck` | an injected type error (`maxLamportsPerTx: "one SOL"`) | clean | `runs/2026-09-27-setup.md` |
| `tools/doctor.py` | a wrong pin (solana 4.3.0), and a PATH without the Solana bins | 12/12 | `runs/2026-09-27-setup.md` |
| `tools/lint_plugins.py`, `tools/scaffold.py --check` | inherited from the Office, where their bite job ran in CI | clean | vendored; not re-shown here yet |
| `tools/claims_lint.py` (session-close gate 4b; a CI step), milestone 2b.2 | the claims as they stood: 11 errors in 9 measured rows; 7 planted faults in its self-test, each caught | 0 errors; 8/8 | `harness/claims_lint.md` |
| `tools/kb_lint.py` (session-close gate 4) | its own first run (a quoted non-ASCII path); 8 faults at once in a scratch copy; a dangling register row; an orphan through `session_close.py` | 0 errors | `harness/kb_lint.md` |
| CI, `.github/workflows/ci.yml`: the four gates above on every push | four faults on a throwaway branch, one per gate; each failed for its own reason | green on `main` | `ci/safety-net.md` |
| the byte decoder: `packages/sdk/test/decode.test.ts`, `pin-table.test.ts` | 24 of 24 against a stub; then 5 planted decoder bugs and 2 in the pin command, each caught | 35/35 with the guard's 9; 300,000 fuzz inputs, no disagreement with kit | `sdk/decode.md` |
| `tools/doctor.py`, the v1 validator | pointed at the 3.1.10 release | 13/13 | `sdk/decode.md` |
| the instruction classifier: `packages/sdk/test/classify.test.ts` | 24 of 25 against a stub, and rule 6's test before its field existed; then 10 planted bugs, each caught | 61/61 in `npm test` | `sdk/classify.md` |
| policy v1: `packages/sdk/test/policy.test.ts` | 12 of 12 against a stub; then 8 planted bugs, 7 caught until a known-answer hash test caught the eighth | 13/13 | `sdk/policy.md` |
| admission: `packages/sdk/test/admission.test.ts` | 31 of 31 against a stub; then 12 planted bugs: 8 caught, 3 more once boundary tests were added, 1 equivalent | 33/33; `npm test` 98/98; the sandbox on a local validator | `sdk/admission.md` |
| durable state: `packages/sdk/test/durable.test.ts` | 8 of 9 against stubs; the latch test once its drains stopped looking like a loop; then 8 planted bugs: 6 caught, fsync untestable here, 1 equivalent | 11/11, the restart battery's 20 SIGKILLs included; `npm test` 109/109 | `sdk/durable.md` |
| Keel hardened and sensor v1: `keel.test.ts`, `sensor.battery.test.ts` | 8 of 10 against stubs (2 upstream reproductions pass); the benign battery's first run found a defect in both sensors; 5 planted bugs, 4 caught, the fifth after a through-the-guard test | 12/12 and 2/2; benign on fresh seeds: v1 0 of 1,200 stopped; `npm test` 123/123 | `sdk/keel.md` |
| the adapters: `packages/sdk/test/adapters.test.ts` | 12 of 12 against stubs; 10 planted adapter bugs and 2 in the RPC client, each caught; then D13, a send of unknown fate reported failed: 2 failing against a stub, 2 more planted bugs caught | 14/14; `npm test` 149/149 | `sdk/adapters.md` |
| D14, the intents: `admission.test.ts`, `adapters.test.ts` | 5 tests failing against the old code; then 7 planted bugs, each caught | 50/50; `npm test` 152/152; the devnet record replays unchanged | `sdk/intents-d14.md` |
| fee escalation against landed payments, two rules measured (R&D, not a gate): `evals/sdk/fee-escalation/run.py` | sensor v1 stopped 15 of 3,000 benign varied-fee payments (the independent evaluator's battery) | the candidate F1: 0 of 3,000, every loop's stop turn unchanged | `sdk/fee-escalation.md` |
| when REGROUND latches, four rules measured (R&D, not a gate): `evals/sdk/latch-variants/run.py` | today's rule latches on scene 5's single re-sign, stopping 10 of 13 good payments | none of the four admits a forbidden proposal; ADR-012 proposes C | `sdk/latch-variants.md` |
| ADR-012 C, LAT-1 to LAT-6: `latch-c.test.ts` | 13 of 24 fail against V0; seven distinct planted faults caught | 24/24, archived streams reproduced and replayed; historical replay breaks enumerated; devnet rerun owed | `sdk/latch-c.md` |
| Private packed SDK, PKG-1 to PKG-3 | four initial failures; four damaged candidates caught; ancestor dependency leakage corrected | four pass outside the repository on Node 26.7.0; publication and stable deployment still owed | `packaging/packed-sdk.md` |
| Maintained package fault injections | the same four damaged candidates each fail their named check | baseline and restored candidate pass; all faults caught | `packaging/ci-faults.md` |
| Maintained ADR-012 fault gate (partial CI-1) | seven guard mutations each fail behavioural assertions | baseline and restored source pass | `ci/latch-faults.md` |
| Signed policy foundation, POL/VER | initial stubs fail; unknown format and window extension fail before correction; nine planted faults caught after correcting one fixture blind spot | 18 pass; isolated signer and Phantom evidence still owed | `sdk/signed-policy.md` |
| Exclusive Linux ownership and storage, OWN/STO | ownership battery: three fail, one pass initially; six maintained planted faults caught; storage cases initially passed | nine focused tests pass; SIG-8 qualification remains owed | `sdk/ownership.md` |
| Admission request binding, LIF-1 | eight fail on prior API; four maintained planted faults caught | eight pass; full lifecycle still owed | `sdk/request-identity.md` |
| Signing journal, LIF-2 | nine fail on prior API; seven maintained planted faults caught | nine pass; signer executor still owed | `sdk/signing-history.md` |
| Conservative signer executor, LIF-3 | six fail against stub; five valid faults caught after two rejected fault runs | twelve pass with fake RPC; operational signer still owed | `signer/core.md` |
| Devnet RPC boundary, RPC-1–4 | ten fail against stub; seven faults caught after one integer-validator miss prompted stronger fixtures | ten pass with fake providers; live drills owed | `signer/rpc.md` |
| Signer host attribution and clock, SIG-4/10 | four initially fail, compatibility case passes; five faults caught | five pass; operational wiring and permissions owed | `signer/authority.md` |
| Owned RPC deadline, RPC-2 | Node 22 CI cancellation; standalone child exits before completion; timer fault caught | eleven RPC cases pass locally; runtime matrix required | `signer/rpc-deadline.md` |
| Bounded Unix transport, SIG-1/2/3/8/10 foundation | six stub failures, two additional boundary failures; initial fault-run cleanup error retained | eleven pass; seven valid faults caught; operational wiring owed | `signer/socket.md` |
| Durable control requests, LIF-4 foundation | nine fail against absent API; eight maintained faults caught | nine pass; handler and pre-admission refusal paths owed | `sdk/control-request.md` |
| Completed socket slots, SIG-2/3 correction | held-open clients exhaust slots; shutdown hang and fixture/selector errors preserved | twelve socket cases pass; eight valid faults caught | `signer/socket-slots.md` |
| Durable method handler, LIF-4/SIG-2/3/4 | seven stub failures and wrong report deadline; fault-run classification issue retained | twenty-three focused cases pass; seven handler and six core faults caught | `signer/handler.md` |
| Pre-admission refusals, LIF-5/SIG-2/3 | four initial failures; already-admitted error route initially passes | 28 focused cases pass; nine handler, nine socket and eight control faults caught | `signer/refusal.md` |
| Recovery pass isolation, LIF-6/SIG-7/8 | four initial failures; duplicated-intent fixture error recorded | seventeen core cases pass; four recovery and six existing core faults caught | `signer/recovery.md` |
| Signed-policy recovery and settled signing, POL-4/LIF-7 | four initial failures; policy upgrade cases already pass and are mutation checked | seventeen focused cases pass; five new and seven existing journal faults caught | `signer/policy-recovery.md` |
| Same-user host composition, SIG/POL | five stub failures; untracked host recovery fails shutdown; fault harness misses/errors retained | seven service cases and eight final faults pass; SIG-11 count 501 is unachieved | `signer/service.md` |
| Explicit sending client, CLT-1–4 | eight stub failures, native syntax error, caller-ID race and stale packed export failures | nineteen client/service cases and ten client faults pass; five installed checks pass | `sdk/sending-client.md` |
| Maintained fault job, CI-1 partial | three stub failures and stale request selector rejected by full aggregation | sixteen campaigns / 105 faults pass locally; five aggregator faults caught | `ci/bite.md` |
| Synthetic properties, CI-2 partial | three stub failures; budget/count/skip/seed and product faults rejected | five workload properties at 10,000 runs each; eight focused tests/eight faults pass | `ci/properties.md` |
| Million-input decoder fuzz, CI-2 partial | three stub failures; process/count/product faults exercised | 1,000,000 synthetic inputs; 189,174 match kit / 810,826 named refusals | `ci/fuzz.md` |
| SOL cap properties, CI-2 partial | asynchronous runner stub fails; planted boundary/reservation faults fail | two properties at 10,000 executions each; five faults caught | `ci/caps.md` |
| Mixed replay, CI-2 partial | two stub failures, old-receipt driver failure and per-tx mutation miss retained | 10,000 decisions / 13,651 entries; eight final faults caught | `ci/replay.md` |
| Queued SDK admissions, CI-2 partial | two stub failures and short-budget fixture miss retained | 1,000 callers; seven admissions / 993 cap denials; seven faults caught | `ci/concurrency.md` |
| Verified SDK process kills, CI-2 partial | two stub failures; wrong-signal/state-restore faults rejected | 100 verified kills / identical recovered histories / replays; seven faults caught | `ci/kills.md` |
| Bounded archive verification, SNP-1 foundation | nine stub failures; fractional clock/options/FIFO failures and source-size mutation miss retained; installed exports fail first | sixteen cases/faults and six installed checks pass; structural integrity only | `sdk/archive.md` |
| the on-chain bound, rehearsed: `apps/onchain/src/squads.ts` on a local validator with Squads v4 cloned from devnet | the program itself refused the past-the-limit and unlisted-destination attempts on chain, and the post-revoke one | the rehearsal, and of the resume | `onchain/squads-local.md` |
| the on-chain bound, on devnet (2a.9) | Squads v4's devnet program refused the stolen key past the limit, to an unlisted address, and after the revoke | **achieved**: every step signed on devnet; the revoke landed 3 slots after its send | `onchain/squads-devnet.md` |
| the cockpit: `inspect.test.ts`, `apps/cockpit/test/cockpit.test.ts` | 3 of 3 and 6 of 6 against stubs; 4 planted bugs, each caught; then, for devnet, the changed tests failing first and 3 more planted bugs caught | 4/4 and 6/6; **achieved on devnet** (2a.10): a screenshot | `cockpit/v0.md` |
| the drain battery: `packages/sdk/test/drain.battery.test.ts` | 3 planted guard faults, each letting a drain through | 40 of 40 denied | `verify/beta-gate.md` |
| a Solana Agent Kit agent, one line changed: `apps/agentkit/src/run.ts` on a local validator | the unguarded baseline: the same agent pays the attacker | drains refused on both paths; whole transactions land; the plugins' path refused at the kit's second signature | `agentkit/sak-local.md` |
| the same agent on devnet (2b.3) | the unguarded baseline pays the attacker, and the kit reports both landed payments as failed | the same verdicts as locally | `agentkit/sak-devnet.md` |
| the demo's scenes end to end: `apps/onchain/src/scenes.ts` on devnet, with the local fallback (2b.1's end-to-end battery; 2b.3) | each scene's refusal is named by its rule in the guard's record; the crash is a real SIGKILL | 5 payments landed, 8 refusals before signing, 2 latches released by the operator, replay 0 divergences | `e2e/scenes-devnet.md` |
| the Beta gate | (each battery's own receipt) | 11 of 11 §11 batteries: nine from a clean clone, on-chain and end to end on devnet; the independent evaluator run is owed | `verify/beta-gate.md` |

CI runs the baseline gates on every push since milestone 2a.1 (`ci/safety-net.md`). The
maintained `bite` job now runs executable fault campaigns; historical manual regressions
and remaining CI-2 thresholds are still owed. Property, fuzz, replay and queued-admission
receipts above state their bounded profiles. The Beta batteries are in `docs/SPEC.md` §11.
