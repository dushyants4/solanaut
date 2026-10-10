# evals/ — receipts

Current maintained fault runner: `ci/bite-current.md` retains actual partition
execution and bound source identity. All campaigns run without skips, partition
three passes, and the other partitions fail the package timeout and unchanged
H11 baseline wait. Restored identities/typecheck pass, complete gate fails,
CLAIMS S110; all process limits stay unchanged.

Node 24 follow-up: `release/node24-owned-report.md` qualifies exact private
4addaa4 under the already installed runtime. Preserve all existing inputs and
limits. Native/type/installed/compiled checks pass with restored identities;
quiet AST fails the unchanged staged wait. Frozen replay matches on both local
runtimes, CLAIMS S109; no complete matrix or stable claim.

Private trusted SDK report: `sdk/owned-report.md` retains absent-method failures,
initial stalled FIFO fixture and installed prior-candidate failure. Queued caller
reporting is not authoritative isolated reporting. Native/type/source/compiled
checks pass with exact restored identities; quiet AST fails the unchanged staged
wait, leaving complete coverage open, CLAIMS S108.

Current durable-writer crash run: `sdk/storage-kills-current.md` uses the exact
49f6d63 implementation and maintained workload on this host's Btrfs filesystem.
All 100 kills/recoveries/replays pass, with preserved exemplar/trial/input hashes;
no power-loss or exhaustive send-boundary claim, CLAIMS S107.

Post-sync journal/mutex identity: `sdk/record-write-identity.md` retains actual
replacement acknowledgement failures and initial installed failure. Native/type/
source/compiled pass with exact restored identities; quiet serial AST fails the
unchanged staged wait. Complete coverage and stable milestones remain open.

Physical append completion: `sdk/record-write-completion.md` preserves missing/
extra-write acknowledgements, fault-site diagnostic and nonempty-journal test
miss. Native/type/source/compiled pass with exact restored identities; quiet
serial AST fails the unchanged staged-baseline wait. Complete coverage stays open.

Existing Node 24 qualification for exact `701372e`:
`release/node24-read-completion.md` retains native/type/installed passes;
all 134 retained compiled faults catch/restored; quiet AST fails the unchanged
staged wait. Bound candidate identities match. Complete coverage remains open.

**Every gate here was shown failing on an injected fault before it was trusted.** A gate never
seen failing might not be checking anything.

Static primary-source research is separate from executable gates: Phantom's
[earlier published MCP pair](firewall/published-contract.md),
[current exact pair](firewall/published-contract-current.md) and
[low-level SDK seam](firewall/published-sdk-seam.md). These preserve route and
support limitations; they establish no live compatibility or release clearance.

| Gate | Shown failing | Then passing | Receipt |
|---|---|---|---|
| private operator release · SNP-5/7, OPR-2, STO-1 | absent source/installed APIs; rule-field fixture and overbroad FIFO trial failures retained | queued prompts/captured signatures, reserved spending and failed-write latch preservation; local native/AST and retained faults pass, S98 | `sdk/owned-release.md` |
| live record consistency · STO-2/3, SIG-8, OWN-2 | wrong option, acknowledged damaged history, installed failure and two semantic misses retained | native/type/source/compiled pass; quiet serial AST fails unchanged baseline wait, S99 | `sdk/live-record.md` |
| existing Node runtime follow-up · PKG-1/2, CI-2 | quiet Node 26 AST deadline failure retained | unchanged Node 24 native/AST/typecheck/installed populations pass, S100; no complete runtime matrix | `release/node24-current.md` |
| journal/mutex aliases · OWN-2/4, SIG-8 | source and installed prior candidate accept linked inodes | native/type/source/compiled pass; quiet serial AST fails unchanged wait, S101 | `sdk/record-alias.md` |
| startup record reads · STO-4, SIG-8, OWN-2 | source and installed previous candidate accept stale read bytes | native/type/source/compiled pass; quiet serial AST fails unchanged wait, S102 | `sdk/record-read-stability.md` |
| complete record reads · STO-5, SIG-8, OWN-2 | short results remove acknowledged history; oversized results accepted; initial global checkpoint fixtures fail | raw-byte check before repair; retain genuine UTF-8 recovery and scoped checkpoint faults; corrected native/type/AST/floors and source/compiled pass | `sdk/record-read-completion.md` |
| private queued redemption · LIF-2, SNP-7, OPR-2, STO-1 | absent source/installed method; fixture/build/pack setup errors and ordinary wait failure retained | shared queue/private bytes, durable success and fixed errors; ordinary repeat/type/source/installed/AST pass, timing instability and full lifecycle remain open | `sdk/owned-redemption.md` |
| SNP-7/LIF owned serialized proposal check | absent native/compiled API, cached reply aliasing and shared byte mutation; retained fixture type error and staging omission | genuine captured private context, FIFO/current-head checks, detached replies and semantic faults; complete bounded facade still owed | `sdk/owned-request-admission.md` |
| PKG-3/SNP safe operator replay | blank-line acceptance, unsafe sources and raw diagnostics; invalid rehash fixture, joined-field collision and installed fixture import error retained | complete streamed history, bounded independent public pins, redaction and source/installed faults; full operational recovery still owed | `sdk/replay-command.md` |
| owned control FIFO · LIF-4/5, SNP-7, OWN-2 | absent APIs, stale inventory and D31 public-method dispatch; ambiguous/source-layout trial setup failures retained | actual owned start/response/result consultation shares admission's FIFO; local component, no bounded-state or service/release qualification | `sdk/owned-control-request.md` |
| private owned facade · SNP-7, OWN-2, partial OPR-2 | absent factory/module, fixture/type errors, redundant-check fault miss, focused branch deficit and unchanged wait failures retained | ordinary/type/source/installed component passes; serial AST wait fails, so complete qualification and bounded/service/release gates remain open | `sdk/owned-guard.md` |
| D32 private admission errors · OPR-2, STO-1, LIF-1 | real append failure and changed-payload retry return an unrecorded object; installed prior candidate fails | private facade rejects negative-sequence replies with a fixed typed error; source/installed/native checks pass, wider qualification remains open | `sdk/owned-admission-error.md` |
| SNP-7/OWN-2/LIF current-head lookup | absent API; unvalidated helper tail mutation; manual/closed-owner and ordering fault misses; earlier compiled API absence | authenticated disk prefix plus complete validated tail, immutable endpoints and maintained faults; admission/boundedness still owed | `sdk/request-index-lookup.md` |
| PHX-3/4 offline tool/network selection | absent component; accessor/proxy substitution and inherited defaults; coverage and campaign omissions | captured immutable devnet-only selection, redacted bounded parsing and maintained fault/coverage checks; full MCP qualification owed | `firewall/filter.md` |
| CI-2 missing committed completion evidence | removing a committed result/marker incorrectly returns pending; retained missing-exception first-red | reader and shutdown refuse before a fresh signal; added fallback fault restores | `ci/mutation-stop.md` |
| CI-2 mutation scratch teardown | hosted ENOTEMPTY masks the primary timeout; immediate-return fixtures fail; missing-signal fault miss retained | bound supervisor completion before deletion, explicit interruption and refusal checks; baseline wait unchanged | `ci/mutation-stop.md` |
| PUB-1 current original history inventory | retained original inspector faults and actual-commit-read correction | refreshed private mirror metadata at owned-publication revision; no contents/rights/publication clearance | `ci/history-owned-publication.md` |
| OWN-2/SNP-4/7 owned index publication / D25 | absent capability, cache race, pointer races, fault misses and installed Node type leak retained | owned immutable generation publication, late cache recheck and Node-neutral declarations; component scope only | `sdk/owned-request-index.md` |
| ELZ published runtime experiment | incompatible initial graph/import probe and unresolved dependency findings retained | actual configured published routes reach missing-key boundaries with fixture counters; graph remains unqualified | `elizaos/published-routes.md` |
| CLT-1/3 runtime argument containers / D24 | native and actual installed missing options raise plain TypeError instead of typed input refusal | object-container guards retain field validation; enhanced existing cases and maintained faults; scoped integration in receipt | `sdk/sending-client-input.md` |
| Private SDK preview consumer | actual installed case fails for absent companion example | complete synthetic installed JavaScript walkthrough; page/scope drafts and artefact identity retained; no publication clearance | `release/staged-preview.md` |
| SNP-5/6, LIF-7 report transitions / D22 | accepted impossible report histories, fixture/type failure and masked unknown-release trial retained | pre-mutation validation and valid unknown/late reconciliation; source/installed fault evidence | `sdk/report-replay.md` |
| SNP-5/6, LIF-2/7 redemption / D23 | absent/denied, duplicate, final, expired and prior signed-policy histories fail refusals | pre-mutation validation and signed context preserve unsigned/negative-height compatibility; source/installed faults | `sdk/redeem-replay.md` |
| SNP-7 internal request index | missing component/module, source races, invalid-report and malformed-option findings retained | independently derived completed-prefix lookup; integrated/installed qualification in parent receipt | `sdk/request-index.md`; `sdk/request-index-integration.md` |
| PUB-1 actual commit reads | cached-graph acceptance, body-read and metadata failures retained; fault setup/missed batch case preserved | sixteen cases/eighteen faults restore; full corrected close follows; no publication review clearance | `ci/history-commit-read.md` |
| SNP-5/6 checkpoint recovery preparation | missing-function, sparse-list defect and missed fixture trials retained | prefix/tail or verified full replay preserves facts; source faults restore; installed/integration follow | `sdk/checkpoint-recovery.md` |
| SNP-5/6, OWN-2 owned recovery | missing capability, descriptor-reuse and early-refusal fault trials retained | actual owner reads/rechecks history; verified fallback preserves evidence; integration follows | `sdk/checkpoint-owned-recovery.md` |
| SNP-1 internal archive streaming | missing iterator and old installed artefact failures retained | immutable provisional yields, backpressure and natural completion; source faults restore; integration follows | `sdk/archive-stream.md` |
| OWN-2/SNP-4/5 record loading | eager evaluation and old installed artefact fail first | lazy maintenance imports preserve captured pins and error identity; scoped evidence only | `sdk/record-loading.md` |
| CI-1 fixed fault partitions | function/workflow/inventory/refusal failures and misses retained | complete exact inventory, mandatory isolated jobs and restoration; corrected ordinary/AST/type pass; hosted qualification follows | `ci/bite-partitions.md` |
| Release progress accounting | explicit reviewed milestone IDs and historical source digests | equal-weight formal completion only; no effort or readiness inference | `release/progress.md` |
| SNP-7 internal streamed recomputation | missing function, array-yield compatibility and initial fixture failures retained | two complete canonical-record reads, maximum historical window and shared decision checker; integrated qualification follows | `sdk/replay-stream.md` |
| SNP-5 validated prefix rebuilding | missing function, older compiled artefact and enlarged definition refuse | fresh controller matches full-stream next decisions; source faults restore; integration follows | `sdk/checkpoint-rebuild.md` |
| SNP-4 owned checkpoint publication | missing function, fixture blind spots, source/installed and critical/inventory/staging refusals retained | source, installed and storage/crash component evidence; final integration below; full cadence/restore remains owed | `sdk/checkpoint-publication.md` |
| SNP-3 opaque checkpoint envelope | stub/installed and inventory/critical/staging refusals; malformed fault literal and overlapped check retained | exact bytes, signatures, framing and byte ceiling pass source/compiled faults; semantic restore remains owed | `sdk/checkpoint-envelope.md` |
| CI-2 ordinary file scheduling | trailing option demonstrably runs files concurrently; real scheduling regression and inventory refuse | leading option and omission fault pass with restoration; exact-revision hosted confirmation follows | `ci/ordinary-serial.md` |
| SNP-3 captured checkpoint bundle | stub failures, array-shape regression and critical/campaign/staging refusals retained | captured payloads and signing domains verified; publication/recovery remain owed | `sdk/checkpoint-bundle.md` |
| POL-2 signature decoding / CI-2 expanded mutation staging | source/installed regressions, scope/inventory refusals and shared fixture failure retained | source and installed cases/faults restored; expanded baseline passes; complete mutation score owed | `sdk/policy-signature.md` |
| PKG-1 compiled checkpoint payloads | absent module in earlier candidate; compiled faults and hosted baseline failure retained | ten installed cases/eighteen compiled faults; recovery diagnostics preserve existing gate; hosted qualification remains owed | `packaging/checkpoint-payloads.md` |
| SNP-3/5 signed admission-state preparation | five stub failures; masked seed-cap trial; campaign and critical-file refusals | six cases/sixteen source faults and restoration; full restore remains owed | `sdk/checkpoint-state.md` |
| SNP-3/5 validated Keel prefix component | original stub failures; missing endpoint case and masked clone fault; campaign/critical-coverage refusals | nine cases/seventeen source faults and restoration; serial ordinary/type checks pass; full restore owed | `sdk/checkpoint-prefix.md` |
| CI-2 completion-record foundation | valid-result stub failure, ignored operator-tool fingerprint and inventory refusal; masked field check retained | twelve focused cases/sixteen real faults and restoration pass; actual supervisor, integrated close and qualification remain owed | `ci/run-completion.md` |
| CI-2 actual run supervisor | stub, foreign worker and uncommitted publication failures; inventory refusal retained | eighteen focused cases/nineteen faults pass; aggregate/close recorded in receipt, mutation integration remains owed | `ci/run-supervisor.md` |
| CI-2 recoverable mutation execution | stub, CLI, inventory and fixture timeout failures retained; orphan retired | six cases/fourteen faults and real staged baseline pass; full score owed | `ci/mutation-recovery.md` |
| CI-2 baseline runtime correction | hosted oldest-runtime failure and captured-command assertion retained | six cases/fifteen faults pass locally; hosted confirmation and full score owed | `ci/mutation-runtime.md` |
| DEP-1 scoped query dependency | old installed crashes, resolver failures and inventory refusal retained | three cases/four faults pass; audit still refuses remaining findings | `ci/dependency.md` |
| CI-2 explicit run environment | unsupported positive mode and masked child-binding fault miss retained; overlapping diagnostic and type failure retained | twenty-three focused cases/twenty-three faults pass; final integration/hosted close in receipt; no mutation integration | `ci/run-environment.md` |
| CI-2 cap fault-trial diagnostics | hosted shrinking timeout, same-seed isolated reproduction, option stub and misleading real-timeout acceptance retained | eight cases, twelve property/five cap faults, restoration and typecheck; integrated 504 root cases pass; CI-only correction 11cd688 passes all thirteen hosted jobs | `ci/caps-first-failure.md` |
| CI-2 serial coverage execution | parser stub and unregistered campaign refuse; arbitrary option passthrough fault caught | three parser cases/three faults, eleven combined gate cases; full current 504-case instrumented population and unchanged floors pass | `ci/coverage-options.md` |
| SNP-3 checkpoint authentication component | stub/export failures, masked key-pin fault, excessive-key containment, type error and unregistered campaign/critical-coverage failures retained | eighteen cases/twenty-two real faults, nine installed checks/five compiled faults, typecheck and complete coverage pass; 35 campaigns/315 caught-fault lines and exact restoration pass; full state restore remains owed | `sdk/checkpoint.md` |
| PUB-1 history inventory preparation | stub/ref-closure failures, equivalent planted edit, graft/lazy-fetch gaps and local tree-ref refusal retained | fifteen cases/thirteen real faults, including cached missing-commit refusal; exact origin-mirror manifest; publication review and root close still owed | `ci/history.md` |
| CI-2 performance-report preparation | eight stub failures; synced regression fixture miss retained | eight focused cases/sixteen faults; timing targets unmeasured; root integration passes | `ci/performance.md` |
| RT-1/RT-3 synthetic traffic | gate/workload/runner stub failures; endpoint error and population-fixture miss retained | thirteen focused cases/eighteen faults; frozen benign target passes; changing-intent failed streams unrefused within horizon; root close pending | `ci/traffic.md` |
| CI-2 real-transaction differential | six report/three comparator stub failures; trailing-data probe errors and version-fixture miss retained | eleven focused cases/twelve faults; fresh block comparison and root integration pass | `ci/differential.md` |
| CI-2 mutation preparation | six stub failures; nested-runner error, scope-removal miss and incomplete runs retained | definition 3: eight report/staging cases, fourteen faults and staged baseline pass; score still owed | `ci/mutation.md` |
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
| Read-only archive command, SNP-2 | six stub failures; installed executable absent; numeric-validation mutation miss retained | eight command cases/seven faults and six installed checks pass | `sdk/archive-cli.md` |
| AST statement/branch coverage, CI-2 partial | gate/calibration/hook/merge stubs fail; initial full coverage deficit; fixture/campaign errors and coercion miss retained | exact SDK/signer/critical-file floors pass after failure-path tests; remaining CI-2 work owed | `ci/coverage.md` |
| the on-chain bound, rehearsed: `apps/onchain/src/squads.ts` on a local validator with Squads v4 cloned from devnet | the program itself refused the past-the-limit and unlisted-destination attempts on chain, and the post-revoke one | the rehearsal, and of the resume | `onchain/squads-local.md` |
| the on-chain bound, on devnet (2a.9) | Squads v4's devnet program refused the stolen key past the limit, to an unlisted address, and after the revoke | **achieved**: every step signed on devnet; the revoke landed 3 slots after its send | `onchain/squads-devnet.md` |
| the cockpit: `inspect.test.ts`, `apps/cockpit/test/cockpit.test.ts` | 3 of 3 and 6 of 6 against stubs; 4 planted bugs, each caught; then, for devnet, the changed tests failing first and 3 more planted bugs caught | 4/4 and 6/6; **achieved on devnet** (2a.10): a screenshot | `cockpit/v0.md` |
| the drain battery: `packages/sdk/test/drain.battery.test.ts` | 3 planted guard faults, each letting a drain through | 40 of 40 denied | `verify/beta-gate.md` |
| a Solana Agent Kit agent, one line changed: `apps/agentkit/src/run.ts` on a local validator | the unguarded baseline: the same agent pays the attacker | drains refused on both paths; whole transactions land; the plugins' path refused at the kit's second signature | `agentkit/sak-local.md` |
| the same agent on devnet (2b.3) | the unguarded baseline pays the attacker, and the kit reports both landed payments as failed | the same verdicts as locally | `agentkit/sak-devnet.md` |
| the demo's scenes end to end: `apps/onchain/src/scenes.ts` on devnet, with the local fallback (2b.1's end-to-end battery; 2b.3) | each scene's refusal is named by its rule in the guard's record; the crash is a real SIGKILL | 5 payments landed, 8 refusals before signing, 2 latches released by the operator, replay 0 divergences | `e2e/scenes-devnet.md` |
| the Beta gate | (each battery's own receipt) | 11 of 11 §11 batteries: nine from a clean clone, on-chain and end to end on devnet; the independent evaluator run is owed | `verify/beta-gate.md` |

ANC-3 structural component: `sdk/archive-anchor.md` retains first failures, the load-sensitive
FIFO failure, nine API/four command faults and seven installed checks. Authenticated replay,
on-chain authority and full anchor milestone remain owed.

SNP-3 signature decoder bound: `sdk/checkpoint-signature.md` retains source/installed
first failures and concurrent integration timing failures. Focused and packed faults
pass; complete snapshots and independent qualification remain owed.

SNP-3 catalogue preparation: `sdk/checkpoint-archives.md` retains initial failures,
the masked serializer fault and caller-array-method regression. Canonical receipt
metadata only; actual file verification and authenticated restore remain separate.

SNP-5/D21: `sdk/malformed-replay.md` reproduces fabricated controller fields in
malformed history; candidate refusal has focused regression/fault proof.
Installed and integrated qualification remain explicit in the receipt.

POL-1/5 public preparation component: `sdk/prepare-policy.md` retains seven first failures,
installed/build/harness errors and the masked symlink fault; nine final faults and eight
installed checks pass. No signing, policy installation or human Phantom qualification.

CI-2 authenticated-history mutation preparation is in `ci/mutation-authentication.md`;
expanded whole-file scope and completion proof retain all earlier targets and floors.
Its hosted Node 22 failure remains visible; corrected matrix and full score are owed.

CI runs the baseline gates on every push since milestone 2a.1 (`ci/safety-net.md`). The
maintained `bite` job now runs executable fault campaigns; historical manual regressions
and remaining CI-2 thresholds are still owed. Property, fuzz, replay and queued-admission
receipts above state their bounded profiles. The Beta batteries are in `docs/SPEC.md` §11.
