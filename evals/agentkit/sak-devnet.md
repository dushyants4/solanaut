# A Solana Agent Kit agent behind the guard, on devnet

Milestone 2b.3 in [docs/ROADMAP.md](../../docs/ROADMAP.md), its Solana Agent Kit half, on devnet. The local-validator
run is [sak-local.md](sak-local.md). It is the same scripted agent, built on `solana-agent-kit` 2.0.10's own classes,
with Solanaut adopted by one changed line:

```
- new SolanaAgentKit(wallet, rpc, {})
+ new SolanaAgentKit(guardedWallet(wallet, guard, { rpc }), rpc, {})
```

The devnet faucet rate-limits this machine, so the operator key paid the agent's fresh in-memory key a float of 0.08
SOL (`--funder`). The script waited for the transfer to finalize, because the kit's own `Connection` reads at
`finalized`.

```
node apps/agentkit/src/run.ts --url https://api.devnet.solana.com --funder keys/devnet-operator.json \
  --treasury FwZ3eNbmGaidCb2vy7uv9LZzJg3aD4effpcGb5reKubn
```

## The run, 2026-10-01, 12:28 UTC

```
the agent E5vWBSwo9ovTKBmrafLz3zR99Kf1qNpmf1dMPqzuuR9 was paid a float of 0.08 SOL by EnJLeivS…Watdq

without Solanaut: new SolanaAgentKit(wallet, rpc, {})
  instructions (the plugins' path): pay the treasury     ERROR: Simulation failed.          wallet asked to sign 2×
  instructions: pay the attacker                         ERROR: Simulation failed.          wallet asked to sign 2×

with Solanaut: new SolanaAgentKit(guardedWallet(wallet, guard, { rpc }), rpc, {})
  a whole transaction: pay the treasury                  landed: 3hEunrtx…                  wallet asked to sign 1×
  a whole transaction: pay the attacker                  DENIED: destination-not-allowed    wallet asked to sign 0×
  instructions (the plugins' path): pay the treasury     DENIED: intent-in-flight           wallet asked to sign 1×
  instructions: pay the attacker                         DENIED: destination-not-allowed    wallet asked to sign 0×

the guard's record: 8 entries; allow, destination-not-allowed, allow, intent-in-flight, destination-not-allowed
treasury holds 0.0577 SOL; the attacker holds 0.05 SOL     (the 0.05 is the unguarded agent's)
```

| Transaction | Result | Devnet signature |
|---|---|---|
| unguarded: 0.01 SOL to the treasury | **landed**, while the kit threw "Simulation failed." | [`2miZ3aLM…`](https://explorer.solana.com/tx/2miZ3aLMCjhbPvToxoszSk6hQ1k1cCXWbNf9EsF1th229xf8y4Ltm5TJgFn2Hu927LE1gFy5MqBYF7KK564XfDLZ?cluster=devnet) |
| unguarded: 0.05 SOL to the attacker | **landed**, while the kit threw "Simulation failed." | [`3VYFsMZV…`](https://explorer.solana.com/tx/3VYFsMZVEZSo97hD3nY18CuemSxWNcqBznmETnNxJexahDCTMWWBot7aBYyeU4xP7TkyeqgJ2gP9K5WZfGF9J35r?cluster=devnet) |
| guarded, a whole transaction: 0.011 SOL to the treasury | **landed**, checked, signed once, sent by the guard | [`3hEunrtx…`](https://explorer.solana.com/tx/3hEunrtxfiuRMMGJs2tqZJAa8s9R2UFcTCm8sSxbmC2H3CNiuKBLhm14NSaf7aTBVVUhL7YGSPJ1PVUMZNwG6Q5g?cluster=devnet) |

## What it shows

**With Solanaut, devnet gave the same verdicts as the local validator:**
- drains were refused on both of the kit's paths, before the wallet was asked to sign;
- a whole transaction was checked, signed once, sent by the guard, and landed;
- the plugins' path was refused at the kit's second signature, which signs a payment whose first signature could
  still land.

## What devnet found that the local validator could not

**The unguarded kit reports a landed payment as failed.** Each unguarded payment landed, and the kit threw
`Simulation failed.` for it. A probe with full error messages, one payment of 0.001 SOL from the devnet agent key,
showed why:

```
sends:  1. ok:     2w5dbdkC4Y9CBtMNG2ks28ByajNRAyjGekswKk1ZxPoEkCmWoGKrwP4xsPtr5H4bhr85mgp8rCUBaxnwzJeqCZXV
        2. thrown: Simulation failed. | Message: Transaction simulation failed: This transaction has already been processed.
the kit threw:    Simulation failed. | … This transaction has already been processed.
the treasury gained 0.001 SOL; the signature: finalized, Ok
```

The kit's `sendTx` sends the signed transaction with preflight, then reads its status once. If no status is there yet,
it waits a second and sends the same bytes again, preflight included
([source](../../kb/sources/2026-10-01_solana-agent-kit-signorsendtx.md)).
- **On a local validator** the first status read already finds the payment, so the loop returns.
- **On devnet** the first read comes too early. The second send's preflight refuses a transaction already processed,
  and the kit throws.

The re-send cannot pay twice, because its bytes are the same. But the agent is told a payment failed that landed. An
agent that retries pays again.

**What that means behind the guard:**
- **On this path, the guard is not reached at all.** The plugins' path is refused earlier, at the kit's second
  signature.
- **On a sign-only path, the guard has a gap: D14.** In a sign-only path the wallet signs and something else sends,
  as the kit's `sendTx` does once its double signing is fixed. Nothing reports the outcome to the guard, which learns
  it only from expiry. A retry of a payment that landed unreported is admitted once its first attempt's last valid
  height has passed. The guard knows the first attempt can no longer land; it does not know that it already did. This
  is defect D14 in `docs/SPEC.md` §10, found here.

## Not shown

- **A model driving the kit.** The agent is scripted.
- **The kit's plugin packages.** They are not installed; their transfers go through `signOrSendTX`, read and run above.
- **A Helius key.** The kit's Helius path was read, not run.

## Regenerate

```
node apps/agentkit/src/run.ts --url https://api.devnet.solana.com --funder keys/devnet-operator.json --treasury <pubkey>
```

The run costs about 0.08 devnet SOL: the unguarded agent pays the attacker 0.05.
