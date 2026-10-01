---
type: source
status: current
url: "https://registry.npmjs.org/solana-agent-kit/-/solana-agent-kit-2.0.10.tgz"
title: "solana-agent-kit 2.0.10, dist/index.js: signOrSendTX, sendTx, getComputeBudgetInstructions"
publisher: "SendAI (npm)"
published: "2.0.10"
fetched: 2026-10-01
checked: first-hand
created: 2026-10-01
updated: 2026-10-01
---

# How Solana Agent Kit 2.0.10 signs and sends

Read in the published package, `npm pack solana-agent-kit@2.0.10` (tarball SHA-256 `11385851…62ee7b13`), and then run
against a local validator (milestone 2b.3).

## Key facts

- **Plugins sign and send through `signOrSendTX(agent, instructionsOrTransaction)`.** A whole transaction goes to
  `agent.wallet.signAndSendTransaction` once.
- **Bare instructions are signed at least twice.** `signOrSendTX` compiles a v0 transaction and calls
  `agent.wallet.signTransaction`, and keeps the result only in its sign-only mode. It then calls `sendTx`, which
  compiles another transaction with a fresh blockhash, signs it again, and sends it. Measured on a local validator: the
  wallet was asked to sign twice for one payment.
- **With a Helius key, more signatures leave the process.** `getComputeBudgetInstructions` signs a full legacy
  transaction with the wallet and posts it, serialized, to `https://mainnet.helius-rpc.com/` for
  `getPriorityFeeEstimate`. It runs once in `signOrSendTX` and again in `sendTx`.
- **An array of transactions throws after the first is sent.** In the loop over an array, the `throw new
  Error("Wallet does not support signAndSendTransaction …")` sits outside the `if`, so it fires after the first
  transaction is signed and sent, whatever the wallet supports.
- **The kit's `Connection` uses web3.js's default commitment.** A freshly funded account is invisible to it until
  finalized.

## What it supports

- `evals/agentkit/sak-local.md`: why the plugins' path is refused behind `guardedWallet`. The second signature is for
  the same payment while the first, signed and discarded, could still land.
- `docs/SPEC.md` §8, integrating with Solana Agent Kit.
- `docs/CLAIMS.md` M12.
- [The BaseWallet note](2026-09-30_solana-agent-kit-basewallet.md).

## Caveats

- Read in compiled JavaScript, not the TypeScript source; line numbers are the dist file's.
- The Helius behaviour was read, not run: no Helius key was used.
- Each of these is a double-send or disclosure hazard only if a discarded or leaked signed transaction is broadcast.
  The kit does not broadcast them itself.
