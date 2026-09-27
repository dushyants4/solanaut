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
| [intake/](intake/) | the human's drops (`Docs-Dashy-Drop/`), registered with SHA-256 |
| [templates/](templates/) | milestone review, source, topic, entity, brief, paper, ADR, run record |

## Topics

### [DeFAI on Solana](wiki/defai/_index.md)
AI agents with wallets: frameworks, where to hook in, failure data. Also:
[incidents, by cause](wiki/defai/incidents.md). Updated 2026-09-27.

### [Competitors and adjacent tools](wiki/competitors/_index.md)
Who already sells caps and allowlists, and where each enforces. Entities: [Squads v4](wiki/competitors/squads.md) ·
[Privy](wiki/competitors/privy.md). Updated 2026-09-27.

### [Gubernaut Keel](wiki/gubernaut/_index.md)
The controller Solanaut depends on: API, postures, limits, upstream findings. Updated 2026-09-27.

### [Solana transactions](wiki/solana/_index.md)
Formats, lookup tables, fees, expiry: what a firewall must decode. Updated 2026-09-27.

### [Agent-wallet security](wiki/security/_index.md)
Why defences inside the model are weak, and the three layers. Also:
[the admission pattern](wiki/security/admission-pattern.md). Updated 2026-09-27.

### [Glossary](wiki/glossary.md)
One meaning per word. Updated 2026-09-27.

## Milestone reviews

| Milestone | Review |
|---|---|
| 0 · Setup | [2026-09-27_P0-setup.md](milestones/2026-09-27_P0-setup.md) |
| R · Research foundation | [2026-09-27_R-research.md](milestones/2026-09-27_R-research.md) |

## Sources

One note per external source, in [sources/](sources/). Each topic page lists the sources it compiles
from; `checked: first-hand` marks a source re-read directly, and `checked: via-agent` one read only by a
research agent.

| Topic | Sources |
|---|---|
| Gubernaut | [npm and the package](sources/2026-09-27_npm-gubernaut-core.md) · [LIMITS.md](sources/2026-09-27_gubernaut-limits.md) · [on-chain receipts](sources/2026-09-27_gubernaut-onchain-receipts.md) · [releases](sources/2026-09-27_gubernaut-releases.md) |
| Incidents | [Freysa](sources/2026-09-27_the-block-freysa.md) · [AIXBT](sources/2026-09-27_cointelegraph-aixbt.md) · [Fake Memories](sources/2026-09-27_arxiv-fake-memories.md) · [Lobstar Wilde](sources/2026-09-27_substack-lobstar-wilde.md) · [Grok and Bankr](sources/2026-09-27_giskard-grok-bankr.md) · [web3.js backdoor](sources/2026-09-27_thehackernews-web3js-backdoor.md) · [ClawHavoc](sources/2026-09-27_thehackernews-clawhavoc.md) |
| Solana | [transactions](sources/2026-09-27_solana-docs-transactions.md) · [lookup tables](sources/2026-09-27_solana-docs-lookup-tables.md) · [fees](sources/2026-09-27_solana-docs-fees.md) · [confirmation](sources/2026-09-27_solana-docs-confirmation.md) · [failed transactions](sources/2026-09-27_arxiv-solana-failed-transactions.md) · [frameworks on npm](sources/2026-09-27_npm-agent-frameworks.md) |
| Competitors | [Privy policies](sources/2026-09-27_privy-solana-policies.md) · [Privy stateful](sources/2026-09-27_privy-stateful-policies.md) · [Turnkey](sources/2026-09-27_turnkey-solana-policy-engine.md) · [Squads](sources/2026-09-27_squads-spending-limit.md) · [Swig](sources/2026-09-27_swig-wallet.md) · [recurring delegation](sources/2026-09-27_solana-recurring-delegation.md) · [the landscape (via-agent)](sources/2026-09-27_agent-landscape-via-agent.md) |
| Security | [NIST reference monitor](sources/2026-09-27_nist-reference-monitor.md) · [Saltzer and Schroeder](sources/2026-09-27_saltzer-schroeder-1975.md) · [Schneier and Kelsey](sources/2026-09-27_schneier-kelsey-secure-audit-logs.md) · [Stripe idempotency](sources/2026-09-27_stripe-idempotency.md) |
| Hackathon | [World's Fair](sources/2026-09-27_colosseum-worldsfair.md) · [Colosseum FAQ](sources/2026-09-27_colosseum-faq.md) |
| Tooling | [the Karpathy vault](sources/2026-09-27_karpathy-obsidian-vault.md) |

## Private

[private/](private/README.md) holds notes on material the human opened explicitly, on this disk only.
Nothing committed cites it.
