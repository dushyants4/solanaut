# The on-chain bound, on devnet

Milestone 2a.9 in [docs/ROADMAP.md](../../docs/ROADMAP.md), **achieved on 2026-10-01**:
- a controlled Squads v4 multisig whose config authority is an operator key;
- the agent's key named only on the spending limit;
- destinations set;
- a stolen-key script refused past the limit;
- the revoke timed.

It ran on devnet, against Squads v4's program `SQDS4ep65T869zMMBKyuUq6aD6EgTu8psMjkvj52pCf`
([ADR-006](../../design/ADR-006-onchain-backstop.md), [docs/SPEC.md](../../docs/SPEC.md) §9). The rehearsal on a
local validator is [squads-local.md](squads-local.md).

The human funded the operator with 0.5 devnet SOL after the faucet refused this machine.

## The run

```
node apps/onchain/src/squads.ts --url https://api.devnet.solana.com --operator keys/devnet-operator.json \
  --agent keys/devnet-agent.json --treasury keys/devnet-treasury.json
```

**The first run** created the multisig, the vault and the limit, and the agent's first use landed. Then the public
devnet RPC answered HTTP 429 ("Too many requests for a specific RPC call") while the script polled for that use's
confirmation, and the script stopped.

**Two fixes followed, and the drill finished on the same accounts:**
- **The polling.** It now waits out a 429 and polls every 2 s on a public cluster. It also waits for the RPC to serve
  the transaction's logs, not only its status.
- **The resume.** `--multisig` and `--limit` let a run carry on with the accounts it made. A resume checks what it
  reuses first: the operator is the config authority, the agent's key is no member, and the limit names the agent's
  key and the treasury only. The resume was rehearsed on a local validator before devnet: a fresh run with `--keep`,
  then a resume through to the revoke, then a resume that adds a fresh limit.

| Step | Result | Devnet signature |
|---|---|---|
| the multisig `CpmAtQJq…eatxM`; config authority and only member: the operator `EnJLeivS…Watdq` | created, 12:04:51 UTC | [`SAPMAqcF…`](https://explorer.solana.com/tx/SAPMAqcFSJhva7WNFPWSRfjqDXYVFZjRHLTK9L4VRgA6jgiEd4Kg73N3JCmn18bLXAsRQMaBkGr1CYcasD5X8xa?cluster=devnet) |
| the vault `FWukY49q…UkZ5` holds 0.1 SOL; the agent's key a 0.01 SOL fee float | funded | [`5B4gLi7P…`](https://explorer.solana.com/tx/5B4gLi7PoTemDh4snHHQwHhrq88rGeR2RBMVD44kMn7bxjy1A6sQpSNg7NQX9Kv9jZ4Kz3EtETWpYNVinaYmDdvt?cluster=devnet) |
| the spending limit `5cVgYvLg…Pn1b`: SOL, 0.02 a day; members: the agent's key `4uzpuDmh…m8PUq` only; destinations: the treasury `FwZ3eNbm…KeKubn` only | added | [`4WBReiSK…`](https://explorer.solana.com/tx/4WBReiSKJZTrMTKTRpzemB38wuyquUhoaU4TT3e6Rq2T21kp2kvbAQwdQwZ4fov8DSXPeUSyPuJfSLysTRXURuj3?cluster=devnet) |
| the agent's key alone: 0.01 SOL to the treasury | **landed** (then the 429) | [`4ExLTdJ3…`](https://explorer.solana.com/tx/4ExLTdJ3HdiW9sRoapimBJ4kbMpoXgA6atFP4ATu9EHVWB72TsrX9ZWULJ85c24Tg1EEXmvoNEW2iWuGXKkYbLb5?cluster=devnet) |
| *resumed, 12:14 UTC:* the checks on the reused accounts | passed: 0.01 SOL remaining | |
| the agent's key alone: 0.01 SOL to the treasury, the rest of the limit | **landed** | [`4SmPkrYc…`](https://explorer.solana.com/tx/4SmPkrYcuhsXpmaaKE49G2cv6qchAFkYbn23WX1txGeZYJMcauHqj6Y4KqR5Q26LrY11fWFjv1mPkqHZQPLuUCKL?cluster=devnet) |
| the agent's key alone: 0.015 SOL to the treasury, past the limit | **refused on chain: `SpendingLimitExceeded`** | [`BhMHHWVG…`](https://explorer.solana.com/tx/BhMHHWVGf86noWLLNiyPW4WMDpLTffEQpHhdtSHaXQctunTALrddiGKVevoXUQuhGbxMfG5cn1Q4kkq4UzdPcVz?cluster=devnet) |
| the agent's key alone: 0.001 SOL to an unlisted address | **refused on chain: `InvalidDestination`** | [`3RSZmTDS…`](https://explorer.solana.com/tx/3RSZmTDSgLGnkb3BLfBs3TeKGju9a7FBEZ7bfMcPQ6xe9ARaYEEQLpFuQ121VGwHWFsk2JumWkoqaBrrcykZNp4H?cluster=devnet) |
| the operator removes the limit | **3 slots** from the slot current at the send to the slot it landed in; the client saw it confirmed after 2,154 ms (send 78 ms, polling every 2,000 ms) | [`4ABvAGog…`](https://explorer.solana.com/tx/4ABvAGogzQZJYRqb3MLr2ouqACN4DscpYDmh3FQcm2mpctShCBJnr8jg31V3ys6ES9jFXc4fJtC3jvAfxXh4hhcE?cluster=devnet) |
| the agent's key alone, after the revoke: 0.001 SOL | **refused: `AccountNotInitialized`** | [`5zg1xKiQ…`](https://explorer.solana.com/tx/5zg1xKiQeMnCLpM9V9TuyLHq7zqwtom2C6vjQyn1FPPT39UifQ9bWLfzma7QuEj96MRigRuU6JDtpzEXLxkXi93K?cluster=devnet) |
| balances at the end | vault 0.08 SOL; treasury 0.02 SOL | |

Each refused attempt was sent without preflight, so the refusal is the Squads program's, recorded on devnet with a
signature.

## The revoke time, measured twice

- **The client's time** runs from the send to the first poll that saw the removal confirmed. It is late by up to
  one poll interval.
- **The chain's own measure:** the slot current when the removal was sent, against the slot it landed in.

The second measure was added after a local run showed the client's time inflated: 3.5 to 4 s locally, while the
removal landed one slot after its send. In that run the client's status read was slow, not the chain. On devnet: 3
slots, and 2,154 ms seen by the client.

## Then: a limit kept in place, for the dashboard (DEMO.md scene 6)

`--multisig CpmAtQJq… --keep --out .sandbox/devnet/squads.json` added a fresh limit to the same multisig, for rent
only. The stolen-key script ran again, and the limit stays for the cockpit to show
([cockpit/v0.md](../cockpit/v0.md)).

| Step | Result | Devnet signature |
|---|---|---|
| the limit `BpEQgCE2…UbWbf`, the same terms | added | [`2ZqjVyQX…`](https://explorer.solana.com/tx/2ZqjVyQXvejEf6umfmtFhfdBZ7xzcbB5BXjzUAHXcUrkXTrxCBvKHRMpv9MM8sRXU5D6vJfZSgXnRMMi8GUhjNq5?cluster=devnet) |
| 0.01 SOL to the treasury | **landed** | [`2FmUAXMS…`](https://explorer.solana.com/tx/2FmUAXMSTJgA6aV3iyyFBi8XfTZNbxNZwJcqfBoQdn9sB7GTySJVpSHUpkmkgiFtne8YoNQVKaPt4ypzcQLeHPP9?cluster=devnet) |
| 0.015 SOL to the treasury | **refused: `SpendingLimitExceeded`** | [`28KU96jY…`](https://explorer.solana.com/tx/28KU96jY8TN7LhJWLj44qMDLHi5fWKmwFVLAGkeNHDtVJvkw7Aipyyj5DuemEdwqWpBqEwdChseA23Pq3T5edrQ2?cluster=devnet) |
| 0.001 SOL to an unlisted address | **refused: `InvalidDestination`** | [`2AVs4FTq…`](https://explorer.solana.com/tx/2AVs4FTqDxcQ2Chc9YASJB8amEp1pbvp9YAeeUjWNCYMtSPWLF9gNRSMLhqYjnWyCLTFMz1G3fJkneru4Q2NYQ4Q?cluster=devnet) |

## What it shows, and what it does not

- **Shown, on devnet:** with Squads v4's deployed program, a key named only on a spending limit moved at most the
  limit, only to its destination, and nothing once the config authority removed the limit. The key needed no seat on
  the multisig.
- **Not shown:**
  - **Mainnet.** ADR-008's canary is deferred by the human.
  - **A Phantom wallet as the operator.** That is milestone 4.4, after the Alpha.
  - **Timing under load.** The revoke was timed once, on a quiet devnet.

## Regenerate

```
node apps/onchain/src/squads.ts --url https://api.devnet.solana.com --operator keys/devnet-operator.json \
  --agent keys/devnet-agent.json --treasury keys/devnet-treasury.json [--multisig <pda> [--limit <pda>]] [--keep --out <f>]
```

The operator needs about 0.15 devnet SOL for a fresh multisig, or only fees and rent to resume one.
