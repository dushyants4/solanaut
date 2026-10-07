# Signed snapshots and streamed recovery — implementation sequence

2026-10-06 · accepted ADR-019 allocation under the Solanaut 1.0 mission.
This is an acceptance map, not evidence of completed recovery or performance.
Requirements: `docs/SPEC.md` SNP-3–8. Thresholds: `docs/READINESS.md`.

## Ordered work

| Step / owner | Dependencies | Delivery and acceptance |
|---|---|---|
| Authentication / builder then evaluator | signed policy/profile identity, SNP-1 archive verification | Canonical checkpoint/prefix signing bytes and externally pinned authority validation. SNP-3 positive, malformed, substitution and altered-content tests fail first. Distinct checkpoint authority; no principal or anchor-key reuse. Authentication alone does not establish correct state. |
| Publication / operator then evaluator | authenticated payload contract, exclusive ownership and complete-write handling | SNP-4 atomic publication under the owner. Preserve the last valid checkpoint across interrupted writes/publication and storage faults. Checkpoint at the accepted cadence and maintenance stop. No additional signer RPC method. |
| Derived restore / builder then evaluator | authentication, publication and retained history | SNP-5 rebuilds Keel through prefix/tail replay and restores admission state. Compare with full replay across policy, latch, reservation, response and signing boundaries. Never accept arbitrary serialized controller numbers. |
| Refusal/fallback / builder then evaluator | derived restore and archive verification | SNP-6 rejects corrupt/foreign/unsupported material, then attempts verified full replay. Missing or unauthenticatable history denies startup. A known anchor mismatch cannot be bypassed by fallback. |
| Streaming/index / builder then evaluator | verified state derivation and request lifecycle | SNP-7 streams immutable segments and tail, indexes historical request identities/responses on disk and bounds active state. Duplicate identities and interrupted index writes remain conservative. Retain full segments for independent replay. |
| Maintenance / integrator, operator then evaluator | restore/index and compatible record readers | SNP-8 stop, verified backup, compatibility check, restore/validate and resume. Higher signed policy version for reverted content. Installed CLI/package and human-run recovery/upgrade drills are separate exit evidence. |

Act in the repository's seats sequentially. Each implementation step keeps its initial failures,
planted faults and misses, reproducible receipt, document/claim updates and private close/sync.
Builder tests are not Claude's independent evidence. Any newly discovered ADR gap becomes a
proposal before dependent implementation. Signer wiring remains subject to unchanged SIG-11
and pending ADR-021; this map authorises no budget expansion.

## Workload and evidence preparation

Before timing or memory measurement, freeze the generator, seeds, machine/runtime details,
storage configuration and analysis. The workload must cover admissions and denials, unresolved
and final outcomes, redemption/sign/send/reply transitions, latch/reset events, policy changes,
historical request retries and segment boundaries. Include outcomes still unresolved at stop;
do not simplify them into settled entries to reduce memory or restart time.

Use the specified history of 100,000 decisions for restart qualification. Measure readiness
after authenticated restoration and Keel reconstruction, with requests actually serviceable;
parsing a snapshot alone is not restart-to-ready. Keep all existing performance, concurrency,
random-kill and soak targets. Report the environment, fresh seeds after definition changes,
failures alongside passes and the exact tested revision. Timing runs do not overlap mutation
workers, fault injection or another workload competing for the reference machine.

Corruption tests distinguish unsigned/malformed data from correctly signed but foreign or
incompatible data. A valid host signature authenticates the checkpoint under the host trust
boundary; it does not protect against a compromised checkpoint host. Independent full replay,
external anchor evidence and the on-chain spending limit remain separate checks.

Crash tests establish the tested process/interruption behaviour, not power-loss durability.
No restart path retries a send-started transaction or discards its reservation. A historical
request answer remains payload-bound after indexing, policy change and restart.

## Outstanding external evidence

Dedicated-user deployment, checkpoint-key protection, installed service lifecycle, human-run
backup/upgrade/revocation drills, Claude RT-2 and the specialist audit remain required. This
sequence neither creates users or keys nor changes repository visibility or publishes packages.
