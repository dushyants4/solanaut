# Solanaut

**A transaction firewall for Solana AI agents.** Before an agent's wallet signs anything, two checks
decide whether it may:

- **A policy** of allowed programs, allowed destinations and spending caps. The model never sees it and
  cannot change it, so a model that has been talked into paying an attacker still cannot pay one.
- **A control loop**, [Gubernaut Keel](https://www.npmjs.com/package/@gubernaut/core). It reads three
  numbers about the stream of proposals and stops a saturating loop: the same failing transaction,
  retried again and again.

Every denial names the rule that made it, and nothing denied is ever signed. Any error denies.

> **Status: verified review done, devnet only.** The guard, its tests and a sandbox exist. The MVP is
> specified in [docs/SPEC.md](docs/SPEC.md) and built in the order of the milestones in
> [docs/ROADMAP.md](docs/ROADMAP.md), each reached when its gate passes. No detection rate is claimed yet: see
> [docs/CLAIMS.md](docs/CLAIMS.md).

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

## How it is designed

The agent **proposes** a transaction, Solanaut **admits** or denies it by a named rule, and only then
is it **signed**. The v1 design adds five things:
- decoding of legacy, v0 and v1 transactions from their bytes, with an allowlist for every instruction;
- a receipt binding each decision to the exact bytes signed;
- intents, so a payment is never re-signed while an earlier attempt could still land;
- a hash-chained, replayable log that is also the guard's memory across restarts;
- on devnet, a Squads v4 spending limit naming the agent's key, which bounds even a stolen key.

| Read | For |
|---|---|
| [docs/PRODUCT.md](docs/PRODUCT.md) | what Solanaut is, why it exists and how it works, on one page |
| [docs/ROADMAP.md](docs/ROADMAP.md) | the milestones, each reached when its gate passes |
| [docs/READINESS.md](docs/READINESS.md) | what a certified, shippable release requires |
| [docs/OVERVIEW.md](docs/OVERVIEW.md) | the code as it is: layout, dependencies, logic, workflows, constraints |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | the long-term shape, and its invariants |
| [docs/SPEC.md](docs/SPEC.md) | the MVP baseline: data models, rules, receipts, adapters, batteries |
| [docs/papers/](docs/papers/) | the litepaper, the threat model, the market, the business plan (draft 1) |
| [design/](design/) | the decisions, ADR-001 to ADR-011 |

## The knowledge vault

This folder is an Obsidian vault. Open it in Obsidian, and [kb/INDEX.md](kb/INDEX.md) is the front
page. Research sources, topic pages, milestone reviews and the document register live in
[kb/](kb/). How it works: [design/ADR-007-knowledge-vault.md](design/ADR-007-knowledge-vault.md).

## Built on

Gubernaut Keel (`@gubernaut/core`, Apache-2.0), used unmodified as a published dependency. It existed
before this hackathon, and is disclosed as such.
