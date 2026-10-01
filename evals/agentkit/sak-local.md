# A Solana Agent Kit agent behind the guard, by one changed line

Milestone 2b.3 in [docs/ROADMAP.md](../../docs/ROADMAP.md), its Solana Agent Kit half: a scripted agent built on
`solana-agent-kit` 2.0.10's own classes is governed by a one-line change. The roadmap asks for this on devnet, with the
local validator as the fallback. This is the fallback run; devnet waits for SOL.

```
- new SolanaAgentKit(wallet, rpc, {})
+ new SolanaAgentKit(guardedWallet(wallet, guard, { rpc }), rpc, {})
```

`apps/agentkit/src/run.ts` uses the kit's own `KeypairWallet`, `SolanaAgentKit` and `signOrSendTX`, with fresh
in-memory keys on `solana-test-validator` 3.1.10. It counts how often the kit asks the wallet to sign.

## The run, 2026-10-01

```
without Solanaut: new SolanaAgentKit(wallet, rpc, {})
  instructions (the plugins' path): pay the treasury         landed                            wallet asked to sign 2×
  instructions: pay the attacker                             landed                            wallet asked to sign 2×

with Solanaut: new SolanaAgentKit(guardedWallet(wallet, guard, { rpc }), rpc, {})
  a whole transaction: pay the treasury                      landed                            wallet asked to sign 1×
  a whole transaction: pay the attacker                      DENIED: destination-not-allowed   wallet asked to sign 0×
  instructions (the plugins' path): pay the treasury         DENIED: intent-in-flight          wallet asked to sign 1×
  instructions: pay the attacker                             DENIED: destination-not-allowed   wallet asked to sign 0×

the guard's record: 8 entries; allow, destination-not-allowed, allow, intent-in-flight, destination-not-allowed
treasury holds 0.021 SOL; the attacker holds 0.05 SOL     (the 0.05 is the unguarded agent's)
```

## What it shows

- **Drains are refused on both of the kit's paths,** before the wallet is asked to sign. The unguarded agent paid the
  attacker; the guarded one could not.
- **A whole transaction works unchanged:** checked, signed once, sent by the guard, its outcome reported.
- **The plugins' path is refused, correctly.** The kit signs each payment built from instructions twice
  ([source](../../kb/sources/2026-10-01_solana-agent-kit-signorsendtx.md)):
  1. it signs once in `signOrSendTX`, keeping that transaction only in sign-only mode;
  2. it signs again in `sendTx`, with a fresh blockhash.

  The first signed transaction is valid and could still land, so the guard refuses the second as
  `intent-in-flight`. That is the rule working: a guard cannot know a signed transaction was thrown away.
- **So "one line" holds for drains everywhere, and for whole transactions.** The kit's plugin actions need the kit to
  stop signing twice, which is upstream work: the finding is recorded for SendAI. Until then, an integrator hands the
  kit whole transactions.

## Also found

- **With a Helius key, the kit posts a fully signed transaction to Helius's mainnet fee API.** It does this once per
  fee estimate, twice per payment. Behind `guardedWallet` that signature is checked and recorded, but it still leaves
  the process. Read, not run.
- **An array of transactions throws after the first one is sent.** An agent that retries on that error would pay
  twice. Intents refuse the retry while the first could still land.
- **The kit's `Connection` reads at `finalized`.** The first run failed until the script waited for its airdrop to
  finalize: a timing artifact of a fresh validator.

## Not shown

- **Devnet.** It waits for devnet SOL.
- **A real model driving the kit.** The agent here is scripted.
- **The kit's plugin packages.** `@solana-agent-kit/plugin-token` was not installed: it brings Light Protocol,
  Mayan, Metaplex, the pump.fun SDK and ethers. Its transfers go through `signOrSendTX`, read above.

## Regenerate

`npm run validator` in one terminal, then `node apps/agentkit/src/run.ts --url http://127.0.0.1:8899`.
