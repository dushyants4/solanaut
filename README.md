# Solanaut

**A transaction firewall for Solana AI agents.** Before an agent's wallet signs anything, two checks
decide whether it may:

- **A policy** of allowed programs, allowed destinations and spending caps. The model never sees it and
  cannot change it, so a model that has been talked into paying an attacker still cannot pay one.
- **A control loop**, [Gubernaut Keel](https://www.npmjs.com/package/@gubernaut/core). It reads three
  numbers about the stream of proposals and stops a saturating loop: the same failing transaction,
  retried again and again.

Every denial names the rule that made it, and nothing denied is ever signed. Any error denies.

> **Status: the Beta MVP is built and validated on devnet; devnet only.** The guard, its adapters for Solana Agent
> Kit and `@solana/kit`, a Squads v4 spending limit and a read-only dashboard are built, each through a gate in
> [docs/ROADMAP.md](docs/ROADMAP.md). The demo's scenes ran end to end on devnet. Every number claimed is in
> [docs/CLAIMS.md](docs/CLAIMS.md) with the command that regenerates it, and no detection rate is claimed.

## Try it

```bash
npm install
npm test                              # the guard's tests
npm run sandbox                       # three scenarios, offline: payments, a drain, a retry loop
npm run validator                     # in another terminal: a local Solana validator
npm run sandbox -- --cluster local    # the same scenarios on it
```

The sandbox prints each proposal, the three numbers the loop saw, its posture, and the verdict. On the
local validator the allowed payments land, and the drain and the loop's last attempt are never sent.

On devnet, `apps/onchain` runs the demo's scenes through the guard and a stolen-key drill against a Squads spending
limit. Their receipts, with every devnet signature, are [evals/e2e/scenes-devnet.md](evals/e2e/scenes-devnet.md) and
[evals/onchain/squads-devnet.md](evals/onchain/squads-devnet.md).

## How it is designed

The agent **proposes** a transaction, Solanaut **admits** or denies it by a named rule, and only then
is it **signed**. The guard v1 adds five things, all built:
- decoding of legacy, v0 and v1 transactions from their bytes, with an allowlist for every instruction;
- a receipt binding each decision to the exact bytes signed;
- intents, so a payment is not re-signed while an earlier attempt could still land, or may have landed unreported;
- a hash-chained, replayable log that is also the guard's memory across restarts;
- on devnet, a Squads v4 spending limit naming the agent's key, which bounds even a stolen key.

| Read | For |
|---|---|
| [docs/PRODUCT.md](docs/PRODUCT.md) | what Solanaut is, why it exists and how it works, on one page |
| [docs/ROADMAP.md](docs/ROADMAP.md) | the milestones, each reached when its gate passes |
| [docs/READINESS.md](docs/READINESS.md) | what a certified, shippable release requires |
| [docs/RISKS.md](docs/RISKS.md) | what could stop the Alpha, each risk with an owner and a mitigation |
| [docs/OVERVIEW.md](docs/OVERVIEW.md) | the code as it is: layout, dependencies, logic, workflows, constraints |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | the long-term shape, and its invariants |
| [docs/SPEC.md](docs/SPEC.md) | the MVP baseline: data models, rules, receipts, adapters, batteries |
| [docs/papers/](docs/papers/) | the litepaper, the threat model, the market, the business plan (drafts) |
| [design/](design/) | the decisions, ADR-001 to ADR-018 (ADR-012 to ADR-018 accepted on 2026-10-05; ADR-008 deferred) |

## The knowledge vault

This folder is an Obsidian vault. Open it in Obsidian, and [kb/INDEX.md](kb/INDEX.md) is the front
page. Research sources, topic pages, milestone reviews and the document register live in
[kb/](kb/). How it works: [design/ADR-007-knowledge-vault.md](design/ADR-007-knowledge-vault.md).

## Built on

Gubernaut Keel (`@gubernaut/core`, Apache-2.0), used unmodified as a published dependency. It existed
before this hackathon, and is disclosed as such.
