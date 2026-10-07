# Individual Linux deployment — acceptance sequence

2026-10-06 · operator/integrator preparation under the approved Solanaut 1.0 mission.
This allocates the operator lifecycle; it is not an installation guide or support claim.
Authority: accepted ADR-019/020, SPEC OPR-1–8 and unchanged READINESS thresholds.

## Dependencies and owners

| Work / owner | Dependencies | Acceptance evidence |
|---|---|---|
| Artefacts / integrator and operator | completed signer, SDK, MCP and operator contracts; resolved dependency findings | Clean Ubuntu 24.04 x86-64 machine installs only reviewed release artefacts. No workspace symlink, undeclared dependency or undocumented loader flag. Approved Node matrix; package manifests, SBOMs and hashes identify exactly what ran. |
| Configuration / builder then evaluator | isolated service and authoritative provider boundary | Validate guard/cluster, signed policy/version/profile and dedicated authority pins; file ownership/modes, protected socket, established history and supported storage. Wrong-network, unsigned/rolled-back policy, shared authority, unsafe permissions, symlink and missing-history fixtures refuse before admissions. Secret values never enter diagnostics. |
| Accounts and keys / human, then evaluator | same-user service complete and human-created dedicated accounts | Human provisions dedicated signer/client permissions and protected devnet keys. Unprivileged agent cannot read signer keys/config/history or bypass through the socket. Cross-user negative tests, effective ownership and exact deployment attribution are recorded. A same-user flag never qualifies isolation. |
| Lifecycle / operator then evaluator | installed executable, ownership and recovered history | Start, readiness, stop/drain and restart operate through the supported service manager. Concurrent starts cannot own one identity; shutdown and interruption retain reservations, latch and uncertain send evidence. No new signer socket method. |
| Policy ceremony / integrator, human and evaluator | POL contracts and installed public preparation command | Prepare exact public text, sign with the operator, verify/install under maintenance, restore and resume. Higher signed version for reverted content. Include wrong-key/version/cluster and pending-attempt tests. Human-run signatures remain distinct evidence. |
| Backup/recovery / operator and evaluator | authenticated snapshots, retained archives, complete restore and compatible readers | Stop admissions and drain work, capture the exact durable boundary, verify copied history and independent pins, restore into an isolated target and validate before resuming. Exclude private-key material and secret environment values. Corrupt/missing/resealed/incompatible inputs refuse; no source history is deleted to manufacture empty state. Measure the existing backup target on the frozen reference workload. |
| Upgrade/rollback / operator and evaluator | verified backup and explicit compatibility information | Check record/profile/policy compatibility before replacing binaries. Restore and validate with unresolved attempts and latch retained. Incompatible binary rollback refuses; compatible rollback passes. Policy content reversal needs a newly signed higher version. Keep the failed candidate and its diagnostic receipt. |
| Failover/revocation/removal / operator, human and evaluator | two-provider service, on-chain limit, signed actions and recovery | Provider outage/disagreement preserves unresolved reservations; total loss denies and reports degraded status. Human performs the required devnet revoke drill. Removal stops and drains services, revokes access and preserves recoverable state by default; irreversible data destruction is a separate human decision. |

H9 controls signer expansion; H4 controls account provisioning. Anchor deployment and operator
actions retain their accepted design/human dependencies. Do not infer permission to create
OS accounts, install machine-wide tools, fund keys, publish or change visibility from this map.

## Frozen user study and drill definitions

Before evaluation, freeze the artefacts, reference image, configuration fixtures, instructions,
task set, timing boundaries and success rubric. Use separate fresh participants/seeds after
definition changes; preserve unsuccessful tasks and corrective edits. Builder rehearsals and
fresh-agent walkthroughs never replace the outside-developer or human usability gates.

The Alpha integration study remains its earlier requirement. The final product study uses the
mission's median time to first guarded transaction and task-success targets; accessibility
uses its WCAG target and automated findings, plus keyboard and assistive-technology checks.
Do not start the clock after an undocumented dependency, funding or configuration step.

Freeze the operational history before backup, upgrade, failover and interruption measurements.
Include allowed/denied transactions, used receipts, unresolved sends, policy changes and an
active latch. Record exact durable sequence/head, observed chain state and reconciliation.
Separate process-crash evidence from power-loss durability and request identity from exactly-once
chain execution. Run timing/soak qualification without competing mutation or fault workloads.

## Exit record

Each OPR requirement links first failure, planted faults, commands, revision, image/runtime,
configuration and limits. Keep component, installed-machine and human-run evidence separate.
Phase 5 does not exit until all applicable lifecycle/usability/devnet gates pass. Audit,
publication, bounty and R.1–R.4 still follow; devnet deployment does not qualify mainnet.
