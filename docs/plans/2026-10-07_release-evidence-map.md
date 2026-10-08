# Solanaut 1.0 — current release evidence map

2026-10-07 · private operator/archivist preparation · reviewed source revision
a4d1c25. This maps the approved mission to receipts and remaining work. It is not
a release decision, support claim or substitute for SPEC/READINESS gates.

The approved Beta remains the achieved milestone. Local component validation is
recorded in CLAIMS S76; hosted run 37711212005 fails Node 22/26 and AST at the
unchanged baseline wait; Node 24 and maintained faults pass. Its predecessor
b352454 passes runtime jobs but fails the unchanged staged-baseline wait in AST;
maintained faults are cancelled. Keep that failure beside subsequent results.

| Mission phase | Evidence available | Work before exit / owner |
|---|---|---|
| Establish mission | Approved mission, accepted ADR-019/020, live boundary receipts, SPEC requirement allocation | Finish resolving dependent architecture decisions; human owns pending H9/H10. Keep requirement acceptance maps current. |
| Foundation and CI | [Latch C](../../evals/sdk/latch-c.md); [maintained gate preparation](../../evals/README.md); [actual history-object checks](../../evals/ci/history-commit-read.md) | Builder/evaluator complete corrected hosted qualification and complete frozen mutation programme; human decides H11 without waiving product targets. Funded devnet scene rerun remains owed. |
| Trusted signing core | [Service component](../../evals/signer/service.md), [RPC component](../../evals/signer/rpc.md), [signed policy](../../evals/sdk/signed-policy.md); checkpoint publication/recovery and [streamed recomputation](../../evals/sdk/replay-stream.md) component receipts | Builder finishes isolated startup after H9, streamed owned restoration, disk request lookup and bounded active state. Evaluator runs the full SIG/POL/SNP interruption, competing-start, storage and runtime batteries. Human provisions isolation accounts/keys. |
| Alpha paths | Existing SDK adapters and default opaque denial; foundational policy/operator interfaces | Builder/integrator implement and qualify TOK/ELZ/PHX/ANC/DSH. Anchor lifecycle depends on H10. Opaque bounds need accepted design and fork proof; otherwise retain denial and qualify the required Phantom paths. |
| Alpha qualification | Scoped synthetic/property/fuzz/differential/replay/concurrency/kill receipts in [evaluation index](../../evals/README.md) | Evaluator completes every RT/READINESS target, including declared performance/soak workloads. Claude owns RT-2 and independent review; human recruits outside developers and reviews Alpha. Builder evidence cannot replace either. |
| Individual product | [Installed SDK preparation](../../evals/packaging/checkpoint-payloads.md); [Linux acceptance sequence](2026-10-06_linux-qualification.md) | Integrator/operator complete SDK, signer, firewall and CLI release artefacts, configuration, service lifecycle, backup/upgrade/recovery/removal and accessible dashboard. Evaluator qualifies Ubuntu/reference runtimes. Human runs Phantom, isolation, usability and devnet drills. |
| Freeze and audit | [History inventory preparation](../../evals/ci/history.md), corrected actual-object checks | Operator freezes a qualified candidate and produces reproducible artefacts/SBOMs; archivist prepares exact revision records. Human commissions specialist audit and completes entire proposed public-history rights/confidentiality review. Auditor re-verifies required fixes. No publication clearance exists. |
| Open source and release | Mission authorises preparation of the original repository | Human chooses licence/visibility and publishes reviewed source, audit, bounty and packages. Operator prepares the approved workflow/attestations; evaluator verifies exact published artefacts and post-publication installation/devnet smoke. All R.1–R.4 remain binding. |
| Maintain and later mainnet | Maintenance scope is allocated in READINESS | After release, operator/human maintain incident, dependency, compatibility and re-audit records. Mainnet requires a separate approved scope and release decision; devnet evidence provides no mainnet qualification. |

## Next engineering work

Continue the accepted [snapshot sequence](2026-10-06_snapshot-qualification.md):
historical request/answer lookup on disk, bounded active state and actual owned
streamed restoration. Preserve payload identity, unresolved reservations, used
receipts, latch and the full evidence history. A cache cannot authorise a negative
lookup unless its complete history binding is established; corrupted or missing
index state must rebuild from verified history or refuse.

Do not wire additional signer implementation past the pending budget decision.
Do not build the proposed anchor ceremony before acceptance. Timing qualification
starts only after workload/analysis and reference environment are frozen, and
runs separately from fault workers. No complete mutation score is inferred from
the selected staged baseline. Pending gates stay explicit, without release dates
or documentation-only exceptions.

No public visibility, package publication, user creation, funding, tool installation,
external contact or policy/threshold change was performed for this map.

Reviewed formal progress on 2026-10-08 is 41%: 16 of 39 equally weighted milestones,
including the approved Beta (CLAIMS S78; [receipt](../../evals/release/progress.md)).
This is not release readiness or an effort estimate. The fixed CI fault-partition
component has local evidence in CLAIMS S77; corrected hosted qualification remains
required. Next disk-index work is isolated from the qualified parent tree.
