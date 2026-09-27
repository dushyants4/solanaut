# Solanaut

**A transaction firewall for Solana AI agents.** Before an agent's wallet signs anything, two
checks decide whether it may:

- **A policy** of allowed programs, allowed destinations and spending caps. The model never sees
  it and cannot change it, so a model that has been talked into paying an attacker still cannot
  pay one.
- **A control loop**, [Gubernaut Keel](https://www.npmjs.com/package/@gubernaut/core), that reads
  three numbers about the stream of proposals and stops a saturating loop: the same failing
  transaction, retried again and again.

Every denial names the rule that made it, and nothing denied is ever signed. Any error denies.

> **Status: day one, devnet only.** The guard, its tests and a sandbox exist. Everything else is
> planned in [docs/HACKATHON.md](docs/HACKATHON.md). No detection rate is claimed yet: see
> [docs/CLAIMS.md](docs/CLAIMS.md).

## Try it

```bash
npm install
npm test                              # the guard's tests
npm run sandbox                       # three scenarios, offline: payments, a drain, a retry loop
npm run validator                     # in another terminal: a local Solana validator
npm run sandbox -- --cluster local    # the same scenarios on it
```

The sandbox prints each proposal, the three numbers the loop saw, its posture, and the verdict.
On the local validator the allowed payments land, and the drain and the loop's last attempt are
never sent.

## Built on

Gubernaut Keel (`@gubernaut/core`, Apache-2.0), used unmodified as a published dependency. It
existed before this hackathon, and is disclosed as such.

Architecture: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).
