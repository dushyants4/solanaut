# INDEX — Solanaut's knowledge base

The front page of `kb/`, and the vault's home. **Every query starts here**, and every ingest, research
pass or milestone review that adds or changes a topic updates it. The archivist keeps it current.

- **How the vault works:** [design/ADR-007-knowledge-vault.md](../design/ADR-007-knowledge-vault.md).
  Open the repository's root folder in Obsidian; this page is bookmarked.
- **Operations** (ingest, research, query, lint): [workflows/knowledge.md](../workflows/knowledge.md)
- **Closing a milestone:** [workflows/milestone_review.md](../workflows/milestone_review.md)

## Registers

| Register | What it holds |
|---|---|
| [DOCUMENTS.md](DOCUMENTS.md) | every public document and paper: version, status, owner, next review |
| [REGISTRY.md](REGISTRY.md) | the upstream code Solanaut depends on, pinned, and findings about it |
| [LOG.md](LOG.md) | an append-only record of every knowledge operation |
| [intake/](intake/) | the human's drops (`Docs-Dashy-Drop/`), registered with SHA-256: [2026-09-27, the setup drop](intake/2026-09-27_dashy-drop.md) |
| [templates/](templates/) | milestone review, source, topic, entity, brief, paper, ADR, run record |

## Topics

### [DeFAI on Solana](wiki/defai/_index.md)
AI agents with wallets: frameworks, where to hook in, failure data. Also:
[incidents, by cause](wiki/defai/incidents.md). Updated 2026-09-27.

### [Competitors and adjacent tools](wiki/competitors/_index.md)
Who already sells caps and allowlists, and where each enforces. Entities: [Squads v4](wiki/competitors/squads.md) ·
[Privy](wiki/competitors/privy.md) · [Phantom](wiki/competitors/phantom.md). Updated 2026-09-30.

### [Gubernaut Keel](wiki/gubernaut/_index.md)
The controller Solanaut depends on: API, postures, limits, upstream findings. Updated 2026-09-27.

### [Solana transactions](wiki/solana/_index.md)
Formats (legacy, v0 and v1, live since 2026-09-15), lookup tables, fees, expiry and durable nonces: what a firewall
must decode. Updated 2026-09-30.

### [Agent-wallet security](wiki/security/_index.md)
Why defences inside the model are weak, and the three layers. Also:
[the admission pattern](wiki/security/admission-pattern.md) ·
[readiness standards](wiki/security/readiness-standards.md). Updated 2026-09-30.

### [Glossary](wiki/glossary.md)
One meaning per word. Updated 2026-09-30.

## Milestone reviews

| Milestone | Review |
|---|---|
| 0 · Setup | [2026-09-27_P0-setup.md](milestones/2026-09-27_P0-setup.md) |
| R · Research foundation | [2026-09-27_R-research.md](milestones/2026-09-27_R-research.md) |
| R2 · Verified review and roadmap | [2026-09-30_R2-verified-review.md](milestones/2026-09-30_R2-verified-review.md) |

## Sources

One note per external source, in [sources/](sources/). Each topic page lists the sources it compiles
from; `checked: first-hand` marks a source re-read directly, and `checked: via-agent` one read only by a
research agent.

| Topic | Sources |
|---|---|
| Gubernaut | [npm and the package](sources/2026-09-27_npm-gubernaut-core.md) · [LIMITS.md](sources/2026-09-27_gubernaut-limits.md) · [on-chain receipts](sources/2026-09-27_gubernaut-onchain-receipts.md) · [releases](sources/2026-09-27_gubernaut-releases.md) |
| Incidents | [Freysa](sources/2026-09-27_the-block-freysa.md) · [AIXBT](sources/2026-09-27_cointelegraph-aixbt.md) · [Fake Memories](sources/2026-09-27_arxiv-fake-memories.md) · [Lobstar Wilde](sources/2026-09-27_substack-lobstar-wilde.md) · [Grok and Bankr](sources/2026-09-27_giskard-grok-bankr.md) · [web3.js backdoor](sources/2026-09-27_thehackernews-web3js-backdoor.md) · [ClawHavoc](sources/2026-09-27_thehackernews-clawhavoc.md) |
| Solana | [transactions](sources/2026-09-27_solana-docs-transactions.md) · [lookup tables](sources/2026-09-27_solana-docs-lookup-tables.md) · [fees](sources/2026-09-27_solana-docs-fees.md) · [confirmation](sources/2026-09-27_solana-docs-confirmation.md) · [failed transactions](sources/2026-09-27_arxiv-solana-failed-transactions.md) · [frameworks on npm](sources/2026-09-27_npm-agent-frameworks.md) · [v1 and larger transactions](sources/2026-09-30_solana-upgrades-larger-transactions.md) · [the v1 reference](sources/2026-09-30_solana-dev-skill-transactions-v1.md) · [durable nonces](sources/2026-09-30_solana-durable-nonces.md) · [lookup-table properties](sources/2026-09-30_anza-lookup-table-properties.md) · [SIMD-0312](sources/2026-09-30_simd-0312-create-account-allow-prefund.md) · [Alpenglow](sources/2026-09-30_solana-alpenglow.md) |
| Competitors | [Privy policies](sources/2026-09-27_privy-solana-policies.md) · [Privy stateful](sources/2026-09-27_privy-stateful-policies.md) · [Turnkey](sources/2026-09-27_turnkey-solana-policy-engine.md) · [Squads](sources/2026-09-27_squads-spending-limit.md) · [Squads: using a limit](sources/2026-09-30_squads-v4-spending-limit-use.md) · [Squads: adding a limit](sources/2026-09-30_squads-v4-add-spending-limit.md) · [Swig](sources/2026-09-27_swig-wallet.md) · [recurring delegation](sources/2026-09-27_solana-recurring-delegation.md) · [Phantom's MCP server](sources/2026-09-30_phantom-mcp-server.md) · [Phantom and Lighthouse](sources/2026-09-30_phantom-lighthouse.md) · [Phantom's domain warnings](sources/2026-09-30_phantom-domain-warnings.md) · [Lighthouse](sources/2026-09-30_lighthouse-program.md) · [coldstar-agent-signer](sources/2026-09-30_coldstar-agent-signer.md) · [Kora](sources/2026-09-30_kora-configuration.md) · [the landscape (via-agent)](sources/2026-09-27_agent-landscape-via-agent.md) |
| Security | [NIST reference monitor](sources/2026-09-27_nist-reference-monitor.md) · [Saltzer and Schroeder](sources/2026-09-27_saltzer-schroeder-1975.md) · [Schneier and Kelsey](sources/2026-09-27_schneier-kelsey-secure-audit-logs.md) · [Stripe idempotency](sources/2026-09-27_stripe-idempotency.md) · [OWASP LLM top 10](sources/2026-09-30_owasp-llm-top10.md) · [OWASP agentic top 10 (via-agent)](sources/2026-09-30_owasp-agentic-top10.md) · [SEAL Safe Harbor (via-agent)](sources/2026-09-30_seal-safe-harbor.md) |
| Hackathon | [World's Fair](sources/2026-09-27_colosseum-worldsfair.md) · [Colosseum FAQ](sources/2026-09-27_colosseum-faq.md) |
| Tooling | [the Karpathy vault](sources/2026-09-27_karpathy-obsidian-vault.md) · [npm versions, 2026-09-30](sources/2026-09-30_npm-registry-versions.md) · [kit signers](sources/2026-09-30_solana-kit-signers.md) · [Solana Agent Kit's BaseWallet](sources/2026-09-30_solana-agent-kit-basewallet.md) · [npm trusted publishing](sources/2026-09-30_npm-trusted-publishing.md) · [verified builds](sources/2026-09-30_solana-verified-builds.md) |

## Private

[private/](private/README.md) holds notes on material the human opened explicitly, on this disk only.
Nothing committed cites it.
