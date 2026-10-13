# HISTORY-MAP.md — old commit IDs to new ones

> 1.0 · 2026-10-13 · owner: archivist · for: anyone following a commit ID cited in this repository's records.
> Register: `kb/DOCUMENTS.md`.

On 2026-10-12, before this repository went public, its history was rewritten to remove one private folder: the
human's planning notes, which were never a source for any claim (`kb/intake/2026-09-27_dashy-drop.md`). Every
commit kept its author, dates, message, parents and content; only its ID changed, because a commit's ID covers
everything it contains.

Records, receipts and claims written before that date cite the old IDs. Find an old ID in the left column to get
the commit that now stands for it. The full 40-character IDs, for tools, are in
[`evals/release/history-rewrite/map.tsv`](../evals/release/history-rewrite/map.tsv), and how this map was checked
is in [`evals/release/history-rewrite.md`](../evals/release/history-rewrite.md).

## Tags

| Tag | Old commit | New commit |
|---|---|---|
| `milestone/0` | `fcf0ab9` | `7225931` |
| `milestone/R` | `65d54b8` | `1cc24b5` |
| `milestone/R2` | `d2540e7` | `474b776` |
| `milestone/beta` | `e925f1d` | `7154cf2` |

## Commits, oldest first (197)

| Date | Old | New | Subject |
|---|---|---|---|
| 2026-09-27 | `154d457` | `f6d6328` | setup: Solanaut, isolated from the Gubernaut workspace, on the Office pattern |
| 2026-09-27 | `fcf0ab9` | `7225931` | close: phase 0 recorded; the Colosseum draft, and the tool that made it |
| 2026-09-27 | `235f343` | `9857722` | kb: the knowledge vault, and the research it holds |
| 2026-09-27 | `65d54b8` | `1cc24b5` | research: the foundation — the MVP spec, draft-1 papers, the vault's gate, both milestones reviewed |
| 2026-09-27 | `0b76e5a` | `2cf3a8e` | pitch: the written pitch in four paragraphs, filed as PITCH.md Draft 2 |
| 2026-09-30 | `d2540e7` | `474b776` | review: the verified review, and a roadmap built on milestones |
| 2026-09-30 | `0c32d68` | `e1bc83d` | ci: the safety net (2a.1), and the human's decisions of 2026-09-30 |
| 2026-09-30 | `48c8c37` | `126f633` | ci: no uv cache; the tools have no dependencies |
| 2026-09-30 | `db18bb0` | `89fb251` | sdk: the byte decoder (2a.2) — legacy, v0 with pinned tables, and v1, without web3.js |
| 2026-09-30 | `44c6c61` | `cbfe607` | sdk: the instruction classifier (2a.3) — an allowlist per instruction, nonces, signers, fees |
| 2026-10-01 | `be31f11` | `ce9b3cb` | sdk: policy v1 (2a.4) — validated at creation, frozen, hashed |
| 2026-10-01 | `8664bd5` | `fb5e906` | sdk: admission (2a.5) — rules 0 to 19, receipts, intents, the latch |
| 2026-10-01 | `1fad2f7` | `4c2f398` | sdk: durable state (2a.6) — the record is the state, restored by replay |
| 2026-10-01 | `2f4caab` | `298bb03` | sdk: Keel hardened and sensor v1 (2a.7) — bytes hashed, telemetry checked, measured |
| 2026-10-01 | `95659b7` | `7021772` | sdk: the adapters (2a.8) — guardedWallet, guardedSigner, SolanautDenied |
| 2026-10-01 | `9c41beb` | `9fb6dc8` | onchain: the Squads v4 drill (2a.9), rehearsed on a local validator |
| 2026-10-01 | `f55d8a5` | `195acd8` | cockpit: dashboard v0 (2a.10) — the record and the Squads limit, read-only, on localhost |
| 2026-10-01 | `0c982ff` | `2274f6e` | evals: the drain battery — 40 incident-shaped transactions, each denied by its named rule |
| 2026-10-01 | `54f8c12` | `4bf454e` | close: the Beta build session — run record, claims S8 and S9, the Beta gate receipt |
| 2026-10-01 | `d93a4e5` | `c643a62` | agentkit: a Solana Agent Kit agent behind the guard by one line (2b.3, the kit's half) |
| 2026-10-01 | `5fa5f91` | `60b52d2` | devnet: 2a.9 and 2a.10 achieved; the demo's scenes and the agent on devnet; D13 closed, D14 found |
| 2026-10-01 | `7421c51` | `026336c` | intents: D14 closed — an unreported attempt may have landed, so it holds its intent |
| 2026-10-01 | `0e40972` | `a246a92` | latch: when REGROUND latches, measured under four rules; ADR-012 proposed |
| 2026-10-01 | `b6f3b5d` | `ba2615e` | claims: every measured row names the command that regenerates it (2b.2), gated |
| 2026-10-01 | `c8a0e73` | `7d047aa` | beta review (2b.4): the draft; README, ARCHITECTURE and LITEPAPER brought to the Beta as built |
| 2026-10-01 | `86f72d0` | `4fde313` | risks: the register for the Alpha's scope (2c.1), Draft 1 |
| 2026-10-01 | `19c168d` | `a1f7209` | readiness: the Alpha's thresholds against the Beta, for confirmation at 2c.1 |
| 2026-10-01 | `be13198` | `f26a74a` | spec: Draft 4 — the Alpha as 51 requirements with IDs (2c.1) |
| 2026-10-01 | `94ba49c` | `26d66f4` | design: ADR-013 (the signer process) and ADR-014 (the operator-signed policy), proposed |
| 2026-10-01 | `c65f41a` | `2a43392` | design: ADR-015, the log anchor's cadence and payer, proposed |
| 2026-10-03 | `1906851` | `0617f31` | evals: the independent evaluator harness, committed; ADR-016 (Token-2022), proposed |
| 2026-10-03 | `5354822` | `2e85804` | design: ADR-017, ElizaOS integration, proposed — the key never enters ElizaOS |
| 2026-10-03 | `39c6f05` | `85811ba` | design: ADR-018, bounding opaque programs, proposed — every Alpha ADR now written |
| 2026-10-03 | `81b372e` | `17c1719` | threat model: Draft 3 — each threat's status as built, with its evidence |
| 2026-10-03 | `d715917` | `d44e832` | progress: 2b.2 done; 2b.4 and 2c.1 drafted for the human; the independent run under way |
| 2026-10-03 | `b34bcf7` | `6022756` | adapters: D15 and D16, found by the independent evaluator, closed test-first; S7 scoped |
| 2026-10-03 | `e7b69ff` | `ec95138` | sensor: fee escalation against landed payments, measured (RK20); R&D, not built yet |
| 2026-10-03 | `f02135c` | `7991c6b` | guard: D17 to D20, found by the independent evaluator run, closed test-first; the run is done |
| 2026-10-03 | `8e43e26` | `e8dc7b6` | sensor: fee escalation scored only against a payment that did not land (RK20), built test-first |
| 2026-10-03 | `688bb1c` | `a5ab842` | close: the run record for 2026-10-01 to 2026-10-03; the Beta review completed for sign-off |
| 2026-10-05 | `90acb0a` | `707f01e` | harness: the boundary guard for Codex, shown failing first; .codex/ hook, sandbox and T4 rules |
| 2026-10-05 | `e925f1d` | `7154cf2` | handoff: Leg 2 won (the Beta signed off, the Alpha's scope approved, ADR-012 C); Leg 3 handed to Codex |
| 2026-10-05 | `2030ef7` | `c1de3ab` | latch: implement ADR-012 C and record 1.0 mission, verified by regressions and planted faults |
| 2026-10-05 | `31abf16` | `f07751b` | packaging: stage compiled SDK, verified by installed consumers and planted faults |
| 2026-10-05 | `f16938c` | `131dc60` | ci: maintain package fault checks, verified with a fresh offline cache |
| 2026-10-05 | `5b4d3d6` | `d43e18b` | ci: maintain latch fault injections, verified by seven assertion failures |
| 2026-10-05 | `6b0dc04` | `b1b88b9` | design: record accepted recovery and operator contracts, verified by baseline gates |
| 2026-10-05 | `4a60f0a` | `b55bd37` | policy: verify signed history and evaluator versions, tested with adversarial restarts |
| 2026-10-05 | `033cd87` | `288d716` | sdk: hold exclusive recovery ownership, verified with storage faults |
| 2026-10-05 | `425dcc8` | `cd15b56` | sdk: bind request identities to admissions, verified with replay faults |
| 2026-10-05 | `948d6a5` | `d139685` | sdk: persist verified signing lifecycle, tested with forged evidence |
| 2026-10-05 | `54ba32f` | `19d2fae` | signer: recover requests conservatively, tested across durable boundaries |
| 2026-10-05 | `c9a84e0` | `52eb271` | signer: validate devnet RPC boundary, verified with provider faults |
| 2026-10-05 | `aecdf8e` | `f95bc69` | signer: record host authority and monotonic time, fault-tested |
| 2026-10-05 | `f810612` | `1cafd7d` | signer: own RPC deadline lifetime, verified by standalone regression |
| 2026-10-05 | `7b55b37` | `397ed6f` | signer: bound Unix socket requests, verified by real sockets and seven faults |
| 2026-10-05 | `7c42a41` | `f553681` | sdk: journal control request identities and answers, verified by eight faults |
| 2026-10-05 | `4af8e80` | `f90be6a` | signer: release completed socket slots, verified by half-open regression |
| 2026-10-05 | `b7d24a5` | `4946282` | signer: wire durable control replies and deadlines, verified by fault batteries |
| 2026-10-06 | `a40375a` | `9c5601b` | signer: persist pre-admission refusals, verified by executor and fault batteries |
| 2026-10-06 | `d64a943` | `01dd409` | records: record refusal runtime CI and clean close evidence |
| 2026-10-06 | `8b92594` | `0807e2a` | signer: isolate recovery failures, verified regressions and faults |
| 2026-10-06 | `2d4b0cb` | `f55d257` | records: record recovery runtime CI and clean close evidence |
| 2026-10-06 | `f6c8641` | `7234a2e` | signer: forbid settled signing, verified policy recovery and faults |
| 2026-10-06 | `f27337d` | `bde78bb` | signer: compose same-user startup and draining, verified faults; budget gate open |
| 2026-10-06 | `f9c0cec` | `7509d3e` | sdk: add explicit socket sending client, verified faults and installed consumers |
| 2026-10-06 | `dc1d6b1` | `ff05bf2` | ci: run maintained faults sequentially, verified inventory and restoration failures |
| 2026-10-06 | `b41c8c7` | `6677bbb` | ci: enforce property execution floors, verified oracle and fault cases |
| 2026-10-06 | `59b2e1c` | `6771327` | ci: enforce million-input decoder fuzz, verified completion and fault gates |
| 2026-10-06 | `f631671` | `4a4ef71` | ci: qualify SOL cap boundaries, verified reservation and async properties |
| 2026-10-06 | `b758463` | `f66e4ea` | ci: pin mixed replay history, verified ten thousand decisions and fault regressions |
| 2026-10-06 | `3c36cb6` | `4dc47bb` | ci: qualify queued SDK admissions, verified exact cap and complete evidence |
| 2026-10-06 | `91589b3` | `a4197d3` | ci: verify persisted-prefix SIGKILL recovery, tested signals and restoration faults |
| 2026-10-06 | `f1b6010` | `da23a1b` | sdk: verify bounded archives, tested pins, source failures and packed consumers |
| 2026-10-06 | `22235e7` | `f7bc180` | sdk: add read-only archive command, verified arguments and installed binary |
| 2026-10-06 | `657e338` | `2ec031d` | ci: enforce AST coverage floors, calibrated counters and verified failure paths |
| 2026-10-06 | `9775c83` | `73e29ec` | ci: prepare Stryker qualification, verified staging and report faults |
| 2026-10-06 | `4c7c2d9` | `689d18f` | docs: document candidate SDK contracts, reviewed exports and error actions |
| 2026-10-06 | `13bb075` | `8bb6e48` | ci: pin real transaction comparisons and timing reports, verified with faults |
| 2026-10-06 | `00c42e8` | `c0c89a2` | validation: bind archive anchors and qualify traffic, tests and planted faults |
| 2026-10-06 | `e508246` | `8393e9c` | sdk: prepare public policy signing requests, command and installed fault tests |
| 2026-10-06 | `a4dba77` | `f889db1` | qualification: extend mutation runtime and reconcile threats, baseline and faults verified |
| 2026-10-06 | `0978aaa` | `8618f33` | history: allocate accepted snapshot recovery requirements, documentation checks verified |
| 2026-10-07 | `a94ecf0` | `9942843` | review: inventory reachable history, verified cases and planted faults |
| 2026-10-07 | `11cd688` | `5ebccc9` | ci: retain actual fault counterexamples, verified process and property regressions |
| 2026-10-07 | `afa0b21` | `f5d063f` | sdk: authenticate checkpoint bindings, verified faults and installed artefacts |
| 2026-10-07 | `068e90c` | `a1f2992` | release: allocate Linux and dependency qualification, verified maps and dry-run limits |
| 2026-10-07 | `3a142ea` | `850b1ac` | ci: bind completion records, verified fixtures and fault restoration |
| 2026-10-07 | `b6d9194` | `ae35cae` | ci: supervise actual child runs, verified interruption and publication faults |
| 2026-10-07 | `ddc8bb0` | `118c36e` | ci: bind evaluation environments, verified isolation and interruption faults |
| 2026-10-07 | `f8d22f9` | `6d004a8` | ci: recover mutation execution, verified baseline and binding faults |
| 2026-10-07 | `fdae9b4` | `46fdbbd` | deps: patch scoped query resolution, verified installed regressions |
| 2026-10-07 | `9ac6e7c` | `eca889e` | ci: correct baseline runtime option, verified captured command and faults |
| 2026-10-07 | `805e8bb` | `fdc7562` | sdk: bound checkpoint signature decoding, verified source and packed faults |
| 2026-10-07 | `40fa2fc` | `1f32cdd` | sdk: harden checkpoint history foundation, verified source and packed faults |
| 2026-10-07 | `afed152` | `ff3d573` | ci: preserve mutation populations and serialize runtime tests, verified faults |
| 2026-10-07 | `23f57d5` | `19b9f04` | sdk: derive validated checkpoint Keel events, verified replay and faults |
| 2026-10-07 | `b9c06eb` | `d0e055f` | sdk: derive checkpoint admission state, verified lifecycle replay and faults |
| 2026-10-07 | `afe482a` | `f42001b` | evals: verify compiled checkpoint payloads and retain baseline diagnostics |
| 2026-10-07 | `2692542` | `a52211b` | sdk: bound policy signature decoding, source and installed faults verified |
| 2026-10-07 | `6d81f8b` | `89b6360` | sdk: assemble checkpoint signing bundles, verify faults and serial CI execution |
| 2026-10-07 | `6162efb` | `2d0e3d1` | sdk: authenticate checkpoint envelopes, verify source and installed faults |
| 2026-10-07 | `0c61fa3` | `fc36416` | sdk: publish owned checkpoints, verified by replay and storage faults |
| 2026-10-07 | `995c5b0` | `308a43d` | sdk: rebuild validated Keel prefixes, verify source and installed faults |
| 2026-10-07 | `f05c84d` | `9657940` | sdk: prepare verified checkpoint recovery, validate fallback and tail faults |
| 2026-10-07 | `49f753b` | `3484384` | sdk: recover checkpoints under kernel ownership, catch alias and lifecycle faults |
| 2026-10-07 | `9a6480f` | `791c801` | ci: verify actual historical commit bodies, catch cached metadata and object faults |
| 2026-10-07 | `c2c2f5c` | `c695fd7` | sdk: stream immutable archives, verify completion and cancellation with faults |
| 2026-10-07 | `b352454` | `6d5ff6a` | sdk: recompute streamed history, preserve array and producer isolation with faults |
| 2026-10-07 | `a4d1c25` | `2b9ce95` | sdk: defer checkpoint imports, verify captured pins and installed record isolation |
| 2026-10-08 | `5b00257` | `5691c68` | ci: partition every fault campaign, prove coverage and preserve release accounting |
| 2026-10-08 | `39c24de` | `430d91e` | sdk: validate recovery transitions and stage indexed preview, verified by source and installed faults |
| 2026-10-08 | `43f20c0` | `f43e40d` | client: validate runtime containers and refresh private preview, verified by source and installed faults |
| 2026-10-08 | `5a33e69` | `96544f3` | sdk: publish owned request indexes, verified by storage and installed faults |
| 2026-10-08 | `0310911` | `961d964` | evals: retain ignored qualification logs, verified by close checks |
| 2026-10-08 | `c2df043` | `66095a5` | ci: confirm mutation shutdown, verified by process and fault batteries |
| 2026-10-08 | `588a1ef` | `692317a` | ci: refuse missing completion evidence, verified by process faults |
| 2026-10-08 | `0332c97` | `80af125` | firewall: filter tools and devnet calls, verified by adversarial and AST checks |
| 2026-10-08 | `7118ae2` | `e095f94` | sdk: bind owned request lookup to current history, verified by faults and packed consumers |
| 2026-10-08 | `d0d8dc3` | `abacb50` | research: qualify Phantom route evidence, checked against exact primary archives |
| 2026-10-09 | `8a343d4` | `9323092` | sdk: serialize owned admissions, verified with replay and fault gates |
| 2026-10-09 | `0a199aa` | `6c89e43` | records: preserve resumed qualification, checked with unchanged close gates |
| 2026-10-09 | `9996f00` | `2bce397` | sdk: harden read-only replay, verified with source and installed faults |
| 2026-10-09 | `789bc7b` | `5aae98e` | docs: retain replay CI refusal and verified local close |
| 2026-10-09 | `b1d8ed1` | `d020ee1` | sdk: serialize owned controls, verified with source and packed faults |
| 2026-10-09 | `4325a03` | `6b8f9c8` | records: retain local backup verification and unpushed finding |
| 2026-10-09 | `36a1ae7` | `e8da039` | sdk: own asynchronous admissions, verified locally with AST wait finding |
| 2026-10-09 | `c891c8c` | `59e6d97` | records: preserve local facade backup and qualification findings |
| 2026-10-09 | `944579d` | `9720d1b` | sdk: refuse unrecorded owned admissions, verified with storage and packed faults |
| 2026-10-09 | `fe6369f` | `16e4f35` | records: retain D32 local backup and outstanding qualification |
| 2026-10-09 | `4d9d1fe` | `806308d` | sdk: queue private redemption, verify receipt and write failures |
| 2026-10-09 | `46922d5` | `472c692` | records: preserve redemption backup and driver timeout evidence |
| 2026-10-09 | `7a64856` | `5143214` | sdk: queue private operator release, verified by native AST and retained faults |
| 2026-10-09 | `fba638a` | `24d1a74` | storage: refuse live journal changes, verified by ownership and installed faults |
| 2026-10-09 | `f5380fb` | `9e80ac5` | release: qualify existing Node 24, verified by native AST and installed consumers |
| 2026-10-09 | `12e3895` | `ddbb202` | docs: scope runtime regeneration commands, verified by unchanged close checks |
| 2026-10-09 | `8b1d29d` | `4c1ae1e` | release: verify Node 24 fault rejection, all retained trials caught and restored |
| 2026-10-09 | `84cac38` | `1104b00` | storage: refuse aliased journal ownership, verified by source and installed faults |
| 2026-10-09 | `67948e6` | `3d56425` | storage: verify record reads before repair, checked by startup and installed faults |
| 2026-10-09 | `701372e` | `52f095c` | sdk: preserve history on incomplete reads, verified with faults and AST |
| 2026-10-09 | `72dde39` | `8e7a559` | release: qualify current reads on Node 24, retain AST failure and fault passes |
| 2026-10-09 | `3fe0f0d` | `b50293d` | sdk: verify synced append lengths, proven with storage and package faults |
| 2026-10-09 | `49f6d63` | `45727c6` | sdk: reject post-sync inode replacement, verified with storage and package faults |
| 2026-10-09 | `ae6ba56` | `e7a3034` | evals: qualify current durable writer with 100 recovered and replayed kills |
| 2026-10-09 | `4addaa4` | `5c54d63` | sdk: queue trusted outcome reports, verified with source and installed faults |
| 2026-10-09 | `227b0bb` | `9388699` | release: qualify current Node 24 candidate, retain coverage and retention findings |
| 2026-10-10 | `826d058` | `f6cfc85` | ci: preserve full runner failures, verify restoration without relaxing limits |
| 2026-10-10 | `f6d5e29` | `094f60a` | eval: qualify isolated package fault execution, preserve validator misses |
| 2026-10-10 | `f1e253f` | `b900319` | sdk: queue private signing journal facts, verified by durable lifecycle faults |
| 2026-10-10 | `2dd8264` | `fc881fd` | eval: qualify current journal on Node 24, retain coverage failure |
| 2026-10-10 | `2067447` | `4cd2174` | eval: expose ignored termination, verify corrected owned-child cleanup |
| 2026-10-10 | `e16c9df` | `71f7b76` | eval: qualify full corrected package proposal, preserve gate ownership |
| 2026-10-10 | `f4f3d92` | `4c89e0d` | release: qualify proposed entry and repeat private artefact build |
| 2026-10-10 | `b5498e8` | `4d8cba3` | release: inventory current local history, retain publication limits |
| 2026-10-10 | `71a1ef4` | `a1e4512` | sdk: verify serialised wallet sends, pass native and installed faults |
| 2026-10-10 | `32abc73` | `6273b01` | ci: preserve full maintained D39 failures, verify exact restoration |
| 2026-10-10 | `001c6c9` | `9a6888e` | sdk: archive raw-buffer correction, retain repeated H11 gate failures |
| 2026-10-10 | `69ada72` | `3031ddb` | records: preserve raw-evidence whitespace finding |
| 2026-10-10 | `e7d92e1` | `94f0bad` | release: qualify prepared wallet archive on installed Node 24 |
| 2026-10-10 | `1633231` | `1cddb19` | ci: diagnose original baseline latency, validate unapplied wait proposal |
| 2026-10-10 | `11234cc` | `3648e25` | ci: measure frozen SDK storage and replay, verify raw history and faults |
| 2026-10-10 | `e715238` | `d51e92d` | sdk: privately own wallet byte captures, verify native and installed regressions |
| 2026-10-10 | `fc3caff` | `9d19b11` | ci: bind corrected SDK timing, retain slower observations and refusal proof |
| 2026-10-10 | `be7d296` | `64c1af5` | sdk: preserve batch reservation candidate, verify failures and installed faults |
| 2026-10-10 | `e537f63` | `2e05dc3` | release: prepare blob verification, retain scope refusal and fault proof |
| 2026-10-11 | `5852778` | `db66257` | release: retain output confinement finding, qualify proposed copy |
| 2026-10-11 | `6c61cf3` | `2a369b5` | release: reproduce current SDK on existing runtimes, verify installed packages |
| 2026-10-11 | `6b1f78d` | `22f65bc` | release: qualify frozen core and installed decoder properties, retain scoped evidence |
| 2026-10-11 | `fd5ec6e` | `f7a3cc6` | release: inventory current private SDK graph, observe missing dependency refusal |
| 2026-10-11 | `7fd964b` | `697ace6` | release: reproduce current SDK recovery and admissions, verify frozen inputs |
| 2026-10-11 | `5cb7f50` | `602d54d` | release: reproduce benign traffic, preserve unresolved loop limits |
| 2026-10-11 | `fa2f6e2` | `5ca496f` | design: propose failed outcome budget, preserve current loop findings |
| 2026-10-11 | `25b4c45` | `2cab698` | release: bind private package inventory, catch identity and graph faults |
| 2026-10-11 | `0810716` | `f226bd8` | release: retain strict schema refusal, bind official inputs |
| 2026-10-11 | `abed480` | `68f69ea` | docs: reconcile current threat model, retain unresolved release findings |
| 2026-10-11 | `ddc3358` | `cf1fec0` | release: qualify installed real corpus, retain native gate failure |
| 2026-10-11 | `7da99f1` | `b52c8c4` | release: qualify installed mixed replay, catch self consistent outcome drift |
| 2026-10-11 | `792f6d0` | `f9533c5` | release: diagnose replay completion blind spot, verify installed recovery |
| 2026-10-11 | `54b15d5` | `7495619` | release: qualify installed queued admissions, catch cap and identity faults |
| 2026-10-11 | `753769d` | `51d9309` | release: measure current installed SDK, verify complete persisted replay |
| 2026-10-11 | `740f1ac` | `15513de` | release: inventory assertion history, catch omitted edits and false clearance |
| 2026-10-11 | `8d51c77` | `42e7611` | release: review recovery assertion reasons, bind historical runner pins |
| 2026-10-11 | `e241b5b` | `7a46b88` | release: record selected consumer assertion reasons, preserve original checks |
| 2026-10-11 | `042409a` | `cd3410f` | release: review typed-error assertions, verify focused current checks |
| 2026-10-11 | `396f096` | `14d5443` | release: explain recovery fixtures, verify current storage checks |
| 2026-10-11 | `66aee1a` | `d70ad40` | release: review private facade assertions, verify current lifecycle checks |
| 2026-10-11 | `6356854` | `0cfae79` | release: review signer assertion history, verify focused boundary checks |
| 2026-10-11 | `b770f7c` | `414be2e` | release: index scoped assertion reasons, reject malformed reference inputs |
| 2026-10-11 | `fdbce77` | `6f1970b` | release: explain coverage assertion expansions, verify current controls |
| 2026-10-11 | `66335f9` | `89b4ead` | release: review staging assertions, verify copied-policy execution |
| 2026-10-11 | `39622d4` | `7481e85` | release: explain smaller assertion changes, verify focused recovery checks |
| 2026-10-11 | `b37b6f6` | `499d16a` | packaging: expose lost head type check, prove proposed consumer regression |
| 2026-10-11 | `32ddf33` | `b3b3416` | release: index frozen assertion reasons, retain confirmed consumer gap |
| 2026-10-11 | `4143a79` | `7a26c97` | signer: expose RPC diagnostic disclosure, verify separate redaction candidate |
| 2026-10-11 | `7be8f41` | `6b12fdf` | docs: reconcile release draft blockers, verify scoped claims and links |
| 2026-10-12 | `9a33b36` | `e7e1901` | public: Apache-2.0, a plain-language README and reading guide, private drop removed |
| 2026-10-12 | `3c349d2` | `4de85af` | records: public-readiness audit and run record; drop rows in CLAUDE.md and AGENTS.md |
