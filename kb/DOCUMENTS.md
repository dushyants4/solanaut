# DOCUMENTS.md — the document register

Property-gate step updates SPEC, RISKS, CLAIMS, HANDOFF and PROGRESS on 2026-10-06;
S33 and evidence in `evals/ci/properties.md`, continuing session run record.
The fuzz step updates those records and RISKS; S34/evidence in `evals/ci/fuzz.md`.
The cap-property step updates the same records; S35/evidence in `evals/ci/caps.md`.

Every public document and paper Solanaut keeps, with its version, status, owner and next review. They
are updated over time, and this is how. `workflows/milestone_review.md` step 4 reviews each row at
every milestone, and `tools/kb_lint.py` fails if a document in `docs/`, `docs/papers/` or
`docs/submission/` is missing from this table, or if a row names a file that does not exist.

**Status:** `draft` (being written) → `review` (waiting for the human) → `current` (approved) →
`superseded` (kept, pointing at its replacement).
**Versions:** Draft 1, Draft 2… until the human approves; then 1.0, 1.1… The version moves on a
substantive change; *last reviewed* moves at every review.

| Document | Version | Status | Owner | For | Last reviewed | Next review |
|---|---|---|---|---|---|---|
| [README.md](../README.md) | 4 | current | integrator | everyone | 2026-10-01 | 2c.1 |
| [docs/PRODUCT.md](../docs/PRODUCT.md) | 1.0 | current | architect | every seat, judges | 2026-09-30 | 2c.1 |
| [docs/ROADMAP.md](../docs/ROADMAP.md) | Draft 3 | review | archivist, with the architect | the human, every seat, judges | 2026-10-05 | every leg |
| [docs/READINESS.md](../docs/READINESS.md) | 2.0 | current | operator, with the evaluator | the human, every seat, auditors | 2026-10-05 | 3.10 |
| [docs/RISKS.md](../docs/RISKS.md) | 1.18 | current | architect, with the evaluator | the human, every seat | 2026-10-06 | every Leg 3 milestone |
| [docs/OVERVIEW.md](../docs/OVERVIEW.md) | Draft 19 | draft | integrator | engineers new to the repo, judges | 2026-10-06 | 3.10 |
| [docs/SPEC.md](../docs/SPEC.md) | Draft 4.24 | current (§13 approved; foundation IDs trace accepted scope) | architect | the builder, evaluator and integrator seats | 2026-10-06 | 3.1, 3.10 |
| [docs/SIGNER.md](../docs/SIGNER.md) | Draft 9 | draft | integrator | operators and signer developers | 2026-10-06 | 3.1 |
| [docs/CLIENT.md](../docs/CLIENT.md) | Draft 1 | draft | integrator | Node SDK consumers | 2026-10-06 | 5.3 |
| [docs/RPC.md](../docs/RPC.md) | Draft 2 | draft | integrator | operators and signer developers | 2026-10-05 | 3.1 |
| [docs/REQUESTS.md](../docs/REQUESTS.md) | Draft 6 | draft | integrator | SDK consumers and signer developers | 2026-10-06 | 3.1 |
| [docs/STORAGE.md](../docs/STORAGE.md) | Draft 1 | draft | integrator | SDK users and Linux operators | 2026-10-05 | 3.1 |
| [docs/POLICIES.md](../docs/POLICIES.md) | Draft 1 | draft | integrator | SDK users and operator-tool developers | 2026-10-05 | 3.2 |
| [docs/PACKAGING.md](../docs/PACKAGING.md) | Draft 2 | draft | integrator | developers and release reviewers | 2026-10-06 | 5.3 |
| [docs/HANDOFF.md](../docs/HANDOFF.md) | Draft 1 | current | Claude; Codex keeps §5 to §7 | Codex, the human, Claude on return | 2026-10-06 | the return to Claude |
| [AGENTS.md](../AGENTS.md) | 1 | current | harness (Claude or the human; not Codex) | Codex | 2026-10-05 | the return to Claude |
| [docs/ARCHITECTURE.md](../docs/ARCHITECTURE.md) | 4 | current | architect | everyone | 2026-10-01 | 2c.1 |
| [docs/HACKATHON.md](../docs/HACKATHON.md) | 3 | current | archivist | the human, every seat | 2026-09-30 | S.1 |
| [docs/CLAIMS.md](../docs/CLAIMS.md) | 3.24 | current (T3) | archivist, sourced | every public sentence | 2026-10-06 | every milestone |
| [docs/papers/LITEPAPER.md](../docs/papers/LITEPAPER.md) | Draft 3 | draft | architect | judges, developers | 2026-10-01 | 2c.1 |
| [docs/papers/THREAT-MODEL.md](../docs/papers/THREAT-MODEL.md) | Draft 3 | draft | architect, evaluator | reviewers, auditors, judges | 2026-10-03 | 3.10 |
| [docs/papers/MARKET.md](../docs/papers/MARKET.md) | Draft 2 | draft | archivist | the human, judges | 2026-09-30 | S.1 |
| [docs/papers/BUSINESS-PLAN.md](../docs/papers/BUSINESS-PLAN.md) | Draft 2 | review | drafted for the human | the human, judges | 2026-09-30 | S.1 |
| [docs/submission/PITCH.md](../docs/submission/PITCH.md) | Draft 3 | draft | the human (T4) | judges | 2026-09-30 | S.1 |
| [docs/submission/DEMO.md](../docs/submission/DEMO.md) | Draft 3 | draft | integrator | judges | 2026-10-01 | S.1 |
| [docs/submission/SUBMISSION.md](../docs/submission/SUBMISSION.md) | Draft 2 | review | the human (T4) | the human | 2026-09-30 | S.1 |

"Next review" names the milestone in `docs/ROADMAP.md` at which the document is reviewed next, never a date.

**Records are not in this register:** the ADRs (`design/`, each with its own status line), run records
(`runs/`), plans (`docs/plans/`) and receipts (`evals/`). A record is kept as written, never revised.

## Changes

| Date | Documents | What changed | Record |
|---|---|---|---|
| 2026-10-05 | SPEC, RISKS, OVERVIEW, HANDOFF, CLAIMS | Solanaut 1.0 mission recorded; accepted ADR-012 C implemented offline; S13 and receipt added; historical replay differences preserved; ADR-019/020 proposals pending | `runs/2026-10-05-codex-solanaut-1.md` |
| 2026-10-05 | SPEC, PACKAGING, CLAIMS, HANDOFF | Private compiled SDK candidate and package evidence; CI reading recovered and baseline runner failure recorded | `runs/2026-10-05-codex-solanaut-1.md` |
| 2026-10-05 | PACKAGING, HANDOFF | Maintained package fault runner added to sequential CI checks | `runs/2026-10-05-codex-solanaut-1.md` |
| 2026-10-05 | CLAIMS, HANDOFF | S14 records passing runtime matrix; maintained latch CI fault subset added | `runs/2026-10-05-codex-solanaut-1.md` |
| 2026-10-05 | HANDOFF, PROGRESS; ADR-019/020 status | The human accepted the proposals after review, allowing dependent signing work | `runs/2026-10-05-codex-solanaut-1.md` |
| 2026-10-05 | SPEC, OVERVIEW, RISKS, POLICIES, CLAIMS, HANDOFF, PROGRESS | Signed policy/version/profile foundation; S15, CLI and policy-aware history evidence | `runs/2026-10-05-codex-solanaut-1.md` |
| 2026-10-05 | SPEC, OVERVIEW, RISKS, STORAGE, CLAIMS, HANDOFF, PROGRESS; TOOLCHAIN | Exclusive Linux ownership and storage fault evidence; S16; explicit flock dependency | `runs/2026-10-05-codex-solanaut-1.md` |
| 2026-10-05 | SPEC, OVERVIEW, REQUESTS, CLAIMS, HANDOFF, PROGRESS | Admission request binding, retry lookup and replay validation; S17 | `runs/2026-10-05-codex-solanaut-1.md` |
| 2026-10-05 | SPEC, OVERVIEW, REQUESTS, CLAIMS, HANDOFF, PROGRESS | Checked signing journal and its evidence; S18 | `runs/2026-10-05-codex-solanaut-1.md` |
| 2026-10-05 | SPEC, OVERVIEW, RISKS, CLAIMS, HANDOFF, PROGRESS | Conservative signer executor foundation, fake-RPC boundaries and remaining operational scope; S19 | `runs/2026-10-05-codex-solanaut-1.md` |
| 2026-10-05 | SPEC, OVERVIEW, RISKS, RPC, CLAIMS, HANDOFF, PROGRESS | Trusted devnet RPC boundary, conservative outcome/lifetime costs and fake-provider evidence; S20 | `runs/2026-10-05-codex-solanaut-1.md` |
| 2026-10-05 | SPEC, OVERVIEW, RISKS, SIGNER, CLAIMS, HANDOFF, PROGRESS | Host attribution, anchored monotonic clock and their qualification limits; S21 | `runs/2026-10-05-codex-solanaut-1.md` |
| 2026-10-05 | SPEC, RPC, CLAIMS, HANDOFF | Owned RPC deadline correction, Node 22 failure and standalone regression; S22 | `runs/2026-10-05-codex-solanaut-1.md` |
| 2026-10-05 | SPEC, SIGNER, OVERVIEW, RISKS, CLAIMS, HANDOFF, PROGRESS | Bounded Unix transport foundation; S23; corrected RPC runtime matrix passes | `runs/2026-10-05-codex-solanaut-1.md` |
| 2026-10-05 | SPEC, REQUESTS, OVERVIEW, RISKS, CLAIMS, HANDOFF, PROGRESS | Durable control journal foundation; S24; socket runtime matrix passes | `runs/2026-10-05-codex-solanaut-1.md` |
| 2026-10-05 | SPEC, SIGNER, CLAIMS, HANDOFF | Completed socket slot correction and S25; assertion/hang/fixture/selector failures retained | `runs/2026-10-05-codex-solanaut-1.md` |
| 2026-10-05 | SPEC, SIGNER, REQUESTS, OVERVIEW, RISKS, CLAIMS, HANDOFF, PROGRESS | Method handler wiring and S26; report deadline correction; socket correction matrix passes | `runs/2026-10-05-codex-solanaut-1.md` |
| 2026-10-06 | SPEC, SIGNER, REQUESTS, OVERVIEW, RISKS, CLAIMS, HANDOFF, PROGRESS | Durable pre-admission refusals and S27; stale progress statements reconciled | `runs/2026-10-06-codex-solanaut-1.md` |

Earlier entries:
Maintained bite job updates SPEC, OVERVIEW, RISKS, CLAIMS, HANDOFF and PROGRESS on
2026-10-06; S32 and partial CI-1 evidence in the continuing run.
Sending client adds CLIENT and updates SPEC, SIGNER, REQUESTS, PACKAGING, OVERVIEW,
RISKS, CLAIMS, HANDOFF and PROGRESS on 2026-10-06; S31 and receipt in the continuing run.
Same-user host composition updates SPEC, SIGNER, OVERVIEW, RISKS, CLAIMS, HANDOFF and
PROGRESS on 2026-10-06; S30, unachieved SIG-11 and proposed ADR-021 in the continuing run.
Signed-policy recovery updates SPEC, SIGNER, RISKS, CLAIMS, HANDOFF and PROGRESS on
2026-10-06; S29 and receipt in `runs/2026-10-06-codex-solanaut-1.md`.
Recovery pass isolation updates SPEC, SIGNER, OVERVIEW, RISKS, CLAIMS, HANDOFF and PROGRESS
on 2026-10-06; S28 and receipt in `runs/2026-10-06-codex-solanaut-1.md`.

| Date | Documents | What changed | Record |
|---|---|---|---|
| 2026-09-27 | all | Register created. OVERVIEW, SPEC, the four papers and the three submission drafts written; README, ARCHITECTURE, HACKATHON and CLAIMS revised to version 2 | `runs/2026-09-27-research-foundation.md` |
| 2026-09-27 | PITCH | Draft 2: the written pitch in four paragraphs (what, why, how, results), traced to CLAIMS rows; the script's M8 line scoped to bots | `runs/2026-09-27-written-pitch.md` |
| 2026-09-30 | all | The verified review: PRODUCT, ROADMAP and READINESS created; SPEC, OVERVIEW, THREAT-MODEL, LITEPAPER, MARKET, BUSINESS-PLAN, DEMO and SUBMISSION to their next draft; README, ARCHITECTURE, HACKATHON and CLAIMS to version 3; PITCH to Draft 3; "next review" now names milestones | `runs/2026-09-30-verified-review-roadmap.md` |
| 2026-10-01 | PRODUCT, ROADMAP, SPEC, OVERVIEW, CLAIMS | PRODUCT 1.0, signed off; ROADMAP Draft 2, the human's decisions; SPEC Draft 3, the effects model, the record and the decisions made while building 2a.2 to 2a.5; OVERVIEW Draft 3, the rebuilt guard; CLAIMS 3.1, evidence moved to the admission battery | `runs/2026-10-01-beta-build.md` |
| 2026-10-01 | SPEC, CLAIMS, OVERVIEW, DEMO | After the devnet runs: SPEC Draft 3 gains D13 and D14, both closed, §7's intents and §11's double-send battery as now built, and the adapter decisions; CLAIMS 3.2 adds S11, S12 and M13, and S10's devnet evidence; OVERVIEW notes the scenes and the follow-up; DEMO Draft 3, every scene run on devnet | `runs/2026-10-01-devnet.md` |
| 2026-10-01 | README, ARCHITECTURE, LITEPAPER, CLAIMS; MARKET and PITCH deferred | The Beta review (2b.4): README 4 and ARCHITECTURE 4, the components as built; LITEPAPER Draft 3, the status as built and measured (S6 to S12); CLAIMS, every measured row's regenerating command (2b.2). MARKET's research was not re-checked and PITCH is the human's, so both move to S.1 unreviewed; PITCH can now cite S6 to S12 | `kb/milestones/2026-10-01_2b-beta.md` |
| 2026-10-05 | ROADMAP, READINESS, RISKS, SPEC, README | The human's decisions: the Beta review signed off (2b.4); the Alpha's scope approved (2c.1). SPEC Draft 4.1, §13 approved and ADR-012 to ADR-018 accepted; READINESS 2.0, the thresholds confirmed; RISKS 1.0; ROADMAP Draft 3, Leg 2 won; README's design row | `runs/2026-10-05-handoff-to-codex.md` |
| 2026-10-05 | HANDOFF, AGENTS (new); CLAUDE | Leg 3 handed to Codex: AGENTS.md, the same law for Codex; docs/HANDOFF.md, the state, the queue, the lessons and the return; CLAUDE.md names both, and the guard's Codex hook | `runs/2026-10-05-handoff-to-codex.md` |
