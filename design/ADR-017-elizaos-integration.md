# ADR-017 · ElizaOS: the key never enters ElizaOS; Solanaut's own plugin signs through the guard

**Status:** **proposed** on 2026-10-03, for the human to accept at milestone 2c.1. It answers ELZ-2 in
[docs/SPEC.md](../docs/SPEC.md) §13.6 and the open question in §12 ("wrap the plugin's action handlers, or its
wallet?"), and is written before milestone 3.6's code.

## Context

From the published code of `@elizaos/plugin-solana` 1.2.6 and 2.0.0-alpha.6
([source note](../kb/sources/2026-10-03_elizaos-plugin-solana-signing.md)):
- **There is no wallet to wrap.** Each signing site reads `SOLANA_PRIVATE_KEY` from the agent's settings, builds a
  web3.js keypair, and signs and sends by itself. 1.2.6 has five such sites (swap, two transfers, the wallet
  service's transfer, and the trading path), and the 2.0 alpha keeps the pattern.
- **Keys can enter from outside.** `createWallet()` returns private keys, and the trading path accepts wallets
  carrying private keys from any registered exchange provider.
- **Without a private key, signing fails closed.** `getWalletKey` throws "Private key not found in settings", while the
  paths that need only `SOLANA_PUBLIC_KEY` keep working.

## Options

| | Approach | Problem |
|---|---|---|
| A | replace the plugin's transfer and swap actions with guarded copies | the key is still in settings, so the wallet service, the trading path and any later action sign around the guard |
| B | wrap the plugin's wallet | there is none: the key is read from settings at each site |
| C | patch web3.js's `sign` and `sendTransaction` in the agent's process | fragile across versions, and in-process code can undo it (T9) |
| D | keep the private key out of ElizaOS; give it only the public key, and add a Solanaut plugin whose actions sign through the guard | the plugin's own signing actions stop working, which is the intent |

## Decision (proposed)

**D.**

1. **ElizaOS never holds the key.**
   - The character's settings carry `SOLANA_PUBLIC_KEY` only. `plugin-solana` keeps its reads: balances, prices and
     providers.
   - Every one of its signing actions throws before it signs.
2. **`@solanaut/plugin-elizaos`**, a small ElizaOS plugin, provides the actions that move value:
   - transfer SOL, and transfer a listed token;
   - swaps, only once opaque programs are bounded (milestone 3.4).

   Each action builds the transaction and hands its bytes to the guard.
   - **Signer mode:** to `solanaut-signer`'s `propose` (ADR-013), so the agent's process never sees the key.
   - **SDK mode:** to `guardedWallet`, with the key in the agent's process, stated as SDK mode (§2.1).
3. **A denial reaches the model as text it can act on.** `SolanautDenied`'s rule and reason go back through the
   action's callback, so the agent reads "refused: destination-not-allowed", not a stack trace.
4. **No exchange provider that passes private keys is registered** in a Solanaut deployment. The README says so, and
   the integration test checks it.

## Consequences

- **What it stops.** Every route by which `plugin-solana` signs, current or added later, because none of them has a
  key. That holds for 1.2.6 and the 2.0 alpha alike, without depending on either's internals.
- **New requirement, ELZ-3:** with only a public key set, each of `plugin-solana`'s signing actions signs nothing. It
  is tested against the published version that 3.6 pins.
- **What the operator gives up.** `plugin-solana`'s own swap and trading features, until Solanaut's plugin offers
  bounded swaps (3.4).
- **Upstream.** A wallet hook in `plugin-solana`, a single signing interface, would let any guard wrap it. That is a
  suggestion for elizaOS, written up, not patched.
- **Not decided here:**
  - ElizaOS's other chain plugins, which are out of scope;
  - which ElizaOS version 3.6 pins, chosen when 3.6 starts, from whichever of 1.x or 2.x is current.
