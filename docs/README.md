# Solanaut's documents: a reading guide

Solanaut is a transaction firewall for Solana AI agents: before an agent's wallet signs anything, a policy the agent
cannot change decides whether it may. This page tells you what to read, in what order, and how long it takes.

## Start here

| Time | Read | What you get |
|---|---|---|
| 2 minutes | [the README](../README.md) | the problem, the idea, what has been shown, and how to try it |
| 5 minutes | [PRODUCT.md](PRODUCT.md) | what Solanaut is, who it is for, and how it works, on one page |
| 15 minutes | [papers/LITEPAPER.md](papers/LITEPAPER.md) | the research and the design, end to end |

## The product and the business

| Read | What it covers |
|---|---|
| [PRODUCT.md](PRODUCT.md) | the one-page product: why, who, what, how |
| [papers/MARKET.md](papers/MARKET.md) | the market: agent wallets on Solana, and what others already offer |
| [papers/BUSINESS-PLAN.md](papers/BUSINESS-PLAN.md) | two paths, open-core company or public good, and the recommendation |
| [submission/PITCH.md](submission/PITCH.md), [submission/DEMO.md](submission/DEMO.md) | the pitch and the demo, as scripts |

## The research

| Read | What it covers |
|---|---|
| [papers/LITEPAPER.md](papers/LITEPAPER.md) | the problem, the design, the evidence and the limits |
| [papers/THREAT-MODEL.md](papers/THREAT-MODEL.md) | who attacks an agent's wallet, how, and which rule stops each attack |
| [CLAIMS.md](CLAIMS.md) | every claim Solanaut makes, its evidence and scope, and the words it refuses to use |
| [ARCHITECTURE.md](ARCHITECTURE.md) | the long-term shape, and the rules that must always hold |
| [../kb/INDEX.md](../kb/INDEX.md) | the research vault: every source, with the date it was checked |

## For developers

Start with the [SDK guide](SDK.md): its first five sections take you from an empty file to a guarded payment.

| Read | What it covers |
|---|---|
| [SDK.md](SDK.md) | the guide, then the reference: every export, every error, and what is still internal |
| [PREVIEW.md](PREVIEW.md) | building the compiled SDK and running it offline, in a project of your own |
| [../packages/sdk/](../packages/sdk/README.md) | the SDK's files and its commands |
| [../apps/](../apps/README.md) | the sandbox, the dashboard, the signer and the devnet scripts, with the command for each |
| [OVERVIEW.md](OVERVIEW.md) | the code as it is: layout, dependencies, logic, workflows |
| [POLICY.md](POLICY.md), [POLICIES.md](POLICIES.md) | operator-signed policies: POLICY for the operator preparing a signature, POLICIES for the developer verifying signed history |
| [SIGNER.md](SIGNER.md), [RPC.md](RPC.md), [CLIENT.md](CLIENT.md) | the separate signer process, its RPC boundary, and its client |
| [STORAGE.md](STORAGE.md), [REQUESTS.md](REQUESTS.md) | how the guard's record survives crashes, and how requests are identified |
| [PACKAGING.md](PACKAGING.md) | how the SDK is built and checked as a package |
| [SPEC.md](SPEC.md) | the full specification: data models, the rules in order, receipts, adapters, test batteries |
| [../STYLE.md](../STYLE.md) | how the code is written |
| [../design/](../design/) | the decision records, ADR-001 to ADR-025 |

## The plan and where it stands

| Read | What it covers |
|---|---|
| [../PROGRESS.md](../PROGRESS.md) | where the build stands today |
| [ROADMAP.md](ROADMAP.md) | the milestones; each is reached when its test gate passes, never by a date |
| [READINESS.md](READINESS.md) | what a certified, shippable release would require |
| [RISKS.md](RISKS.md) | the risk register: each risk with an owner and a mitigation |
| [HACKATHON.md](HACKATHON.md) | the hackathon's rules, and how Solanaut meets them |

## The build's working files

Solanaut was built by one developer directing AI coding agents. Their working files are public on purpose. You do not
need them to understand the product.

| Read | What it covers |
|---|---|
| [HANDOFF.md](HANDOFF.md) | the hand-over from Claude Code to Codex, with Codex's work log |
| [reviews/](reviews/) | Claude's reviews of Codex's work, the latest first: [2026-10-13](reviews/2026-10-13-codex-leg3.md) |
| [HISTORY-MAP.md](HISTORY-MAP.md) | commit IDs cited before 2026-10-12, mapped to today's history |
| [plans/](plans/) | the approved plans |
| [PRODUCT-PAGE.md](PRODUCT-PAGE.md), [release/STAGED-RELEASE.md](release/STAGED-RELEASE.md) | drafts for a future product page and release, not yet approved |
| [../evals/](../evals/) | the evidence: every test gate, seen failing first, then passing |
| [../runs/](../runs/) | one record per working session |
