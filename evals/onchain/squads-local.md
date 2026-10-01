# The on-chain bound, rehearsed on a local validator

Milestone 2a.9 in [docs/ROADMAP.md](../../docs/ROADMAP.md) asks for this **on devnet**: a controlled Squads v4 multisig
whose config authority is an operator key, the agent's key named only on the spending limit, destinations set, a
stolen-key script refused past the limit, and the revoke timed ([ADR-006](../../design/ADR-006-onchain-backstop.md),
[docs/SPEC.md](../../docs/SPEC.md) §9).

**2a.9 is not achieved yet.** The devnet faucet refused every airdrop from this machine on 2026-10-01 with a rate-limit
error: 1, 0.5 and 0.2 SOL, then 0.5 again later. The operator key needs about 0.15 devnet SOL. Until it has it, this
is the rehearsal: the same script, run on a local validator holding **Squads v4's program cloned from devnet**, the
same bytecode, at `SQDS4ep65T869zMMBKyuUq6aD6EgTu8psMjkvj52pCf`, with its program config.

## The run, 2026-10-01

```
solana-test-validator 3.1.10 --url https://api.devnet.solana.com \
  --clone-upgradeable-program SQDS4ep65T869zMMBKyuUq6aD6EgTu8psMjkvj52pCf --clone BSTq9w3kZwNwpBXJEvTZz2G9ZTNyKBvoSeXMvwb4cNZr
node apps/onchain/src/squads.ts --url http://127.0.0.1:8899 --operator keys/devnet-operator.json \
  --agent keys/devnet-agent.json --treasury keys/devnet-treasury.json
```

| Step | Result |
|---|---|
| the multisig `B6PD9hJw…dxtFMb` | its members: the operator `EnJLeivS…Watdq` only. The agent's key is **not** a member |
| the vault `BWkHZMeq…T8qN5m` | funded with 0.1 SOL; the agent's key holds a 0.01 SOL fee float |
| the spending limit `FdT7mxzx…KwdJRv` | SOL, 0.02 a day; members: the agent `4uzpuDmh…m8PUq` only; destinations: the treasury `FwZ3eNbm…KeKubn` only |
| the agent's key alone, 0.01 SOL to the treasury | **landed** |
| the agent's key alone, 0.015 SOL to the treasury, past the 0.01 remaining | **refused on chain: `SpendingLimitExceeded`** |
| the agent's key alone, 0.001 SOL to an unlisted address | **refused on chain: `InvalidDestination`** |
| the operator removes the limit | **1,055 ms** from send to confirmed |
| the agent's key alone, 0.001 SOL, after the revoke | **refused: `AccountNotInitialized`** |
| balances at the end | vault 0.09 SOL; treasury 0.01 SOL |

The refused attempts were sent without preflight, so each refusal is the Squads program's, recorded on the validator
with a signature. The script prints public keys and signatures only.

## What it shows, and what it does not

- **Shown:** with Squads v4's real program, a key named only on a spending limit can move at most the limit, only to
  its destinations, and nothing once the config authority removes the limit. The agent's key needed no seat on the
  multisig ([source](../../kb/sources/2026-09-30_squads-v4-spending-limit-use.md)).
- **Not shown:** devnet's own timing, and devnet's signatures for the run record. The revoke time above is a local
  validator's, which confirms far faster than a public cluster.

## To finish 2a.9

1. Fund the operator `EnJLeivSjYXLmvmLKzXDy7m9cT23sMBCZpHGkZWtatdq` with at least 0.15 devnet SOL, from
   [faucet.solana.com](https://faucet.solana.com) or a devnet faucet the human prefers.
2. `node apps/onchain/src/squads.ts --url https://api.devnet.solana.com --operator keys/devnet-operator.json --agent keys/devnet-agent.json --treasury keys/devnet-treasury.json`
3. Paste its output into the run record, with the devnet explorer links it prints.
