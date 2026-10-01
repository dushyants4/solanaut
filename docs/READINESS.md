# READINESS.md — from MVP to a certified, shippable release

> **Draft 2** · 2026-10-01 · owner: operator, with the evaluator · for: the human, every seat, and future auditors ·
> not public. Milestones, not dates (`docs/ROADMAP.md`). Nothing here is claimed until its evidence exists
> (`docs/CLAIMS.md`). This is not legal advice. Register: `kb/DOCUMENTS.md`.

## What "certified" means here

Solanaut calls a release certified only when three things hold:
1. **Every checklist item below has its evidence**: a receipt in `evals/` first shown failing on an injected fault, a
   run record, or an external report.
2. **An independent audit** of the code that moves funds has been published, with every critical and high finding
   fixed and re-verified.
3. **The external attestations named in R.4 exist**: build provenance, a supply-chain score and a verified program
   build.

The word "certified" is not used in public until all three hold, and then only alongside the attestations it rests
on. `docs/CLAIMS.md` §4 bans it until then.

## The stages

| Milestone | Entry | Exit criteria, all of which must hold | Evidence |
|---|---|---|---|
| R.1 · Release candidate | Leg 5 won | the code that moves funds is frozen; a CycloneDX software bill of materials for each package; threat model v3; `SECURITY.md` with a disclosure address; CI green with every gate below; the performance targets measured; no open critical or high finding | the release-candidate tag, CI runs, receipts |
| R.2 · Independent audit | R.1 | a Solana-specialist firm the human chooses audits the decoder, the policy, receipts, the signer, the MCP firewall and `solanaut_anchor`; every critical and high finding is fixed and re-verified by the firm; mediums are fixed or accepted in writing; the report is published | the report |
| R.3 · Bounty and disclosure | R.2's report | a live bug bounty with scope and tiers; a 90-day coordinated disclosure policy; the Security Alliance's SEAL 911 emergency line in the runbooks | the bounty page, `SECURITY.md` |
| R.4 · General availability, 1.0 | R.3 | npm trusted publishing, which attaches provenance attestations; SLSA build provenance; an OpenSSF Scorecard of at least 8; the OpenSSF Best Practices badge at "passing"; `solanaut_anchor` with a verified build, a `security.txt`, and its upgrade authority on a Squads multisig or the program made immutable; a support and security-patch policy; an incident drill passed; the publish pressed by the human (T4) | the attestations, and the drill's record |
| R.5 · Operate | R.4 | quarterly incident drills; a re-audit whenever code that moves funds changes; a yearly threat-model review; dependency updates only with verified provenance | the records |

## Quality assurance

**The Beta gate** is `docs/SPEC.md` §11. **The Alpha's thresholds**, for milestone 3.10, are these:

| Area | Target |
|---|---|
| Rule tests | every rule has a positive and a negative test, both seen failing first |
| Coverage of `packages/sdk/src` | at least 95% of statements and 90% of branches |
| Mutation score, StrykerJS, on the decoder and the policy | at least 80% |
| Property tests, fast-check | at least 10,000 runs per property in each CI run |
| Decoder fuzzing | at least a million inputs; every exception becomes a fail-closed denial, never a crash |
| Differential decoding | at least 1,000 real mainnet transactions across legacy, v0 and v1, with no mismatch against `@solana/kit` and the `@solana-program` parsers for supported programs |
| Replay determinism | no divergence on Node 22, 24 and 26 over 10,000 decisions |
| Crash recovery | 100 kills at random points: no lost reservation, no double admission |
| Concurrency | 1,000 proposals at once: exactly the cap admitted |
| Integration | a Surfpool mainnet fork with Squads, Token-2022 and a Jupiter route bounded by Lighthouse; then devnet end to end |
| Soak | 72 hours on devnet: no crash, memory growth of 10% or less, no invariant broken |
| Red team | at least 40 cases in at least 10 classes, each denied by its named rule or bounded on-chain |
| Benign traffic | a false-stop rate whose 95% upper bound is at most 2%, over at least 2,000 proposals in at least 5 traffic profiles |
| Loops | the stop turn reported for identical, fee-escalating and alternating loops |
| Outside developers | at least 3 integrate the SDK in 30 minutes or less each |

**Test levels.** Each level has positive, negative, edge and adversarial cases:
- unit tests per rule and per decoder branch;
- property and fuzz tests on the decoder and the caps;
- differential tests against library decoders and on-chain execution;
- integration on LiteSVM, a Surfpool mainnet fork, and a local validator, which must be Agave 4.2.2 or later for v1;
- end to end on devnet, then the canary on mainnet (Leg 4, if the human accepts ADR-008).

### The Alpha's thresholds against the Beta, for confirmation at 2c.1

Milestone 2c.1 confirms this test plan with the human, so no threshold is dropped silently once Leg 3 starts
(`docs/RISKS.md`, RK14). Each row gives where the Beta stands, measured on 2026-10-01, and a proposal. **Nothing here
changes a threshold until the human confirms it.**

| Area | The Beta, measured | Proposal |
|---|---|---|
| Rule tests | every rule has tests, seen failing first (`evals/sdk/admission.md`) | keep |
| Coverage | 98.2% of lines and 91.1% of branches in `packages/sdk/src`, by Node 26's built-in coverage, which counts lines, not statements. Lowest branch coverage: `latch.ts` 60%, `adapters/kit.ts` 68%, `inspect.ts` 76%, `pda.ts` 77%, `record.ts` 79% | keep the totals, measured as statements by a coverage tool in CI (3.9); **add** a floor of 85% of branches for each file that decides, records or releases (`guard.ts`, `state.ts`, `classify.ts`, `message.ts`, `policy.ts`, `record.ts`, `latch.ts`) |
| Mutation score | about 70 bugs planted by hand across the milestones; no tool score | keep: StrykerJS on the decoder and the policy at 3.9 |
| Property tests | none with fast-check; the decoder's fuzzing is hand-written | keep |
| Decoder fuzzing | 300,000 inputs, no disagreement with kit (S9) | keep: one million |
| Differential decoding | 300 messages built by kit; no real chain traffic | keep. It reads public mainnet blocks through an RPC; no funds move, and nothing is claimed about mainnet |
| Replay determinism | Node 26 only | keep: Node 22, 24 and 26. Node 22 strips types by default only from 22.18, so pin that minor |
| Crash recovery | 20 kills, identical records (S6) | keep: 100 kills |
| Concurrency | 50 proposals in one tick (`evals/verify/beta-gate.md`) | keep: 1,000 |
| Integration | none on a fork | keep. If a Jupiter route cannot be bounded on the fork, the Alpha ships with opaque programs denied, and says so (RK6) |
| Soak | none | keep 72 hours. On the public devnet RPC, rate limits would end it first (RK16): run it on a local validator, and on devnet only with an RPC the human provides |
| Red team | 40 drain shapes, by the session that built the code (S8); the independent evaluator run under way | keep, and **add**: by an evaluator who did not build the code, given only the spec |
| Benign traffic | 1,200 synthetic proposals in 2 profiles; 95% upper bound 0.64% (S7) | keep: 2,000 in 5 profiles, still synthetic, and said to be |
| Loops | stop turns reported: identical 3, rising fees 4, alternating not stopped in 12 | keep, and **add** a stream of runs of failed outcomes (`docs/SPEC.md` §12) |
| Outside developers | none | keep. Only the human can recruit them. A fresh agent following only the README may be reported beside them, never in their place |

## Security programme

| Practice | Criterion |
|---|---|
| Threat model | reviewed at every leg; v3 before R.1; every threat has a mitigation, a status and a stated residual |
| Red team | Leg 3's campaign, which is also ADR-003's "adversarial test campaign" |
| Audit | R.2, by a Solana-specialist firm, with the off-chain code in scope as well as the program |
| Supply chain | `npm ci` from the lockfile; `npm audit signatures` in CI; no unreviewed install scripts; trusted publishing at release |
| Keys | no real-funds key in this tree; the signer isolates the key; production custody (a KMS or HSM, a remote signer, or Phantom's key service) decided and documented before R.4 |
| Disclosure | `SECURITY.md`, a 90-day policy, and SEAL 911 for emergencies; the SEAL Safe Harbor framework only if Solanaut ever holds pooled funds |

## Performance

These are targets, not claims. Each is measured on a named reference machine, with its version and command, before it
appears anywhere public.

| Measure | Target |
|---|---|
| decision latency in process, before the log write | p99 of 5 ms or less |
| decision latency including the synced log write | p99 of 25 ms or less |
| throughput per guard identity | at least 200 decisions a second |
| replay speed | at least 5,000 decisions a second |
| restart to ready, with state restored | 5 seconds or less for a 100,000-decision log, with snapshots |
| dashboard freshness | each decision shown within a second |
| regression gate | CI fails when a p99 worsens by more than 20% |

## Standards mapped

The item-by-item mapping to Solanaut's gates is filled in as each milestone is reached.

| Standard | How it applies |
|---|---|
| NIST SSDF, SP 800-218 | its practices for preparing, protecting, producing and responding map onto the gates in `evals/` and `tools/` |
| OWASP Top 10 for LLM Applications, 2025 | Solanaut bounds Excessive Agency (LLM06); it does not solve Prompt Injection (LLM01), it contains what an injected model can sign |
| OWASP Top 10 for Agentic Applications, 2026 | its tool-misuse, privilege-abuse, supply-chain and cascading-failure risks map onto the policy, the principal, the lockfile and the latch |
| NIST AI Risk Management Framework | govern, map, measure and manage map onto `docs/CLAIMS.md`, the threat model, the batteries and the runbooks |
| SLSA build track; OpenSSF Scorecard and Best Practices | R.4's supply-chain attestations |
| Solana verified builds; `security.txt` | R.4, for `solanaut_anchor`. A verified build proves the source matches the deployment, not that the code is secure |
| OWASP ASVS, level 2 | a hosted dashboard, before any public link |
| SOC 2 Type II, ISO/IEC 27001 | only if a hosted service is ever launched (Path A in `docs/papers/BUSINESS-PLAN.md`) |
| A legal review of custody status | before any hosted or custodial offering, or any public challenge: the human's, with counsel |

## Operational readiness

| Area | Criterion |
|---|---|
| Monitoring | metrics for verdicts by rule, the latch, spend against each cap, fees, landing rate, confirmation time, RPC errors, decision latency, log write latency and replay status |
| Alerting | a latch trip pages the operator; spend at 80% of a cap warns; a replay divergence or a broken chain is critical; an RPC error rate above 5% for 5 minutes warns |
| Stability | the 72-hour soak above |
| Failover | at least two RPC providers with health checks; on total loss the signer denies and the dashboard shows degraded; one writer per identity, so no split brain |
| Recovery | back up in 5 seconds or less with exact state; no decision lost, because each is synced before it is answered |
| Deployment | local, then a Surfpool fork, devnet, the mainnet canary and general availability; signed tags; release notes written for the consumer; rollback by version pin and policy hash; programs deployed only through the Squads-held upgrade authority |
| Incidents | runbooks for key compromise, latch storms, decoder bugs, dependency compromise and RPC outages; the spending limit revoked within 2 minutes, measured in a drill; a post-mortem for every incident |
| Kill switches | the off-chain latch, released only by the operator; on-chain, removing the spending limit |
| Network changes | before each mainnet step, re-check upgrades that move timing: Alpenglow makes confirmed and finalized the same, and a separate upgrade halves slot times, which shortens a blockhash's life in seconds |

## Sources

- npm trusted publishing: [kb/sources/2026-09-30_npm-trusted-publishing.md](../kb/sources/2026-09-30_npm-trusted-publishing.md)
- Solana verified builds: [kb/sources/2026-09-30_solana-verified-builds.md](../kb/sources/2026-09-30_solana-verified-builds.md)
- SEAL Safe Harbor and SEAL 911: [kb/sources/2026-09-30_seal-safe-harbor.md](../kb/sources/2026-09-30_seal-safe-harbor.md)
- OWASP Top 10 for LLM Applications: [kb/sources/2026-09-30_owasp-llm-top10.md](../kb/sources/2026-09-30_owasp-llm-top10.md)
- OWASP Top 10 for Agentic Applications: [kb/sources/2026-09-30_owasp-agentic-top10.md](../kb/sources/2026-09-30_owasp-agentic-top10.md)
- Alpenglow: [kb/sources/2026-09-30_solana-alpenglow.md](../kb/sources/2026-09-30_solana-alpenglow.md)
- The topic page: [kb/wiki/security/readiness-standards.md](../kb/wiki/security/readiness-standards.md)

## Changes

| Version | Date | What changed |
|---|---|---|
| Draft 1 | 2026-09-30 | First draft, from the verified review. |
| Draft 2 | 2026-10-01 | The Alpha's thresholds against the Beta as measured, with a proposal for each, for the human to confirm at milestone 2c.1. |
