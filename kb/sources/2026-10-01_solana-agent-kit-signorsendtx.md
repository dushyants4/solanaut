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
against a local validator and then devnet (milestone 2b.3).

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
- **`sendTx` re-sends until it sees a status, and reports a landed payment as failed.** Its loop:
  1. sends the signed transaction with `skipPreflight: false` and `maxRetries: 0`;
  2. reads `getSignatureStatuses` once;
  3. if there is no status yet, waits out the rest of a second and sends the same bytes again, for up to 90 s.

  Measured on devnet on 2026-10-01, three payments in all. Each landed, its second send's preflight failed with
  "This transaction has already been processed", and the kit threw `Simulation failed.`. On a local validator the
  first status read already finds the payment, so the loop returns and nothing is thrown.

## What it supports

- `evals/agentkit/sak-local.md`: why the plugins' path is refused behind `guardedWallet`. The second signature is for
  the same payment while the first, signed and discarded, could still land.
- `docs/SPEC.md` §8, integrating with Solana Agent Kit.
- `docs/CLAIMS.md` M12 and M13.
- `evals/agentkit/sak-devnet.md`: the devnet run, and the probe with the full error.
- [The BaseWallet note](2026-09-30_solana-agent-kit-basewallet.md).

## Caveats

- Read in compiled JavaScript, not the TypeScript source; line numbers are the dist file's.
- The Helius behaviour was read, not run: no Helius key was used.
- The discarded and leaked signed transactions are a double-send or disclosure hazard only if one is broadcast. The
  kit does not broadcast them itself.
- The re-send in `sendTx` cannot land twice: its bytes are the same. Its hazard is the false failure the agent is
  told, which invites a retry that can.
