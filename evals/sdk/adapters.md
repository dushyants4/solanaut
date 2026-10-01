# The adapters: shown failing, then passing

Milestone 2a.8 in [docs/ROADMAP.md](../../docs/ROADMAP.md): `guardedWallet` with exactly Solana Agent Kit's `BaseWallet`
members and a comparison after signing; the `@solana/kit` partial signer; `SolanautDenied`; the same verdicts as the SDK
([docs/SPEC.md](../../docs/SPEC.md) §8). Run on 2026-10-01 with Node 26.7.0, `@solana/web3.js` 1.99.0 and
`@solana/kit` 8.4.0.

| File | What it is |
|---|---|
| `packages/sdk/src/adapters/agent-kit.ts` | `guardedWallet(wallet, guard, { rpc })` |
| `packages/sdk/src/adapters/kit.ts` | `guardedSigner(signer, guard)` |
| `packages/sdk/src/adapters/rpc.ts` | `jsonRpc(url)`: height, send, outcome, over plain JSON-RPC |
| `packages/sdk/src/errors.ts` | `SolanautDenied { rule, reason, decision }` |
| `packages/sdk/test/adapters.test.ts` | 13 tests |

**The interface is Solana Agent Kit's own.** `BaseWallet` was read from the published `solana-agent-kit` 2.0.10 tarball
(`npm pack`, SHA-256 `11385851…62ee7b13`, `dist/index.d.ts` lines 229 to 270). The package was not installed: it brings
LangChain, the OpenAI agents SDK and the AI SDK. A real agent runs on it at milestone 2b.3. The tests' wrapped wallet
behaves as that package's `KeypairWallet` does: it signs the caller's object in place.

**Still no web3.js in the SDK.** The adapters read web3.js transactions by their shape.

## 1. Failing first

Twelve tests ran against stubs whose functions threw `not implemented`:

```
ℹ tests 12   ℹ pass 0   ℹ fail 12
```

The typecheck at that point found a mismatch in the stubs' own types. They described a kit transaction's lifetime in
a way kit's durable-nonce transactions did not fit. That was fixed in the types; no test changed.

## 2. Then passing

```
✔ guardedWallet exposes exactly BaseWallet's members, frozen, and never the wallet it wraps
✔ guardedWallet refuses a wallet whose key is outside the policy's principal, or no RPC to send through
✔ signTransaction: an allowed payment is signed by the wrapped wallet; a drain throws SolanautDenied before the wallet is asked
✔ the adapters give the same verdicts as the SDK, for legacy and v0 transactions
✔ a re-sign of the same payment while the first could still land throws intent-in-flight
✔ a wallet that changes the message before signing it is caught: its signatures are stripped, and the call throws
✔ a wallet whose signature does not verify over the admitted bytes is caught
✔ signAllTransactions is all or nothing: one denial signs none, and the admitted ones are released
✔ signAndSendTransaction: checks, signs, sends exactly the admitted bytes itself, and reports the outcome
✔ a send the RPC refuses is reported failed, and rethrown
✔ signMessage is denied: a raw signature over chosen bytes can be a transaction signature
✔ guardedSigner: checks every transaction first, all or nothing, reads expiry from the lifetime, and verifies the signatures it returns
✔ jsonRpc: sends base64 bytes, reads the height, and turns signature statuses into outcomes
ℹ tests 13   ℹ pass 13   ℹ fail 0          (npm test: 136 of 136)
```

The **same verdicts** test runs six cases through both a bare guard and `guardedWallet`, as legacy and as v0
transactions: a payment, a drain, over the cap, a durable nonce, an unlisted program, and a memo with a payment. Every
verdict matches.

The **modifying wallet** appends an instruction to the caller's transaction and signs it, as a wallet that adds its
own assertions would. The guard sees a different message, removes the signature from the caller's object, and
throws.

## 3. Twelve planted bugs, twelve caught

| Planted bug | Failing tests |
|---|---|
| nothing checked after signing | 2 |
| only the message compared, the signature not verified | 1 |
| a mismatched signature left on the caller's object | 1 |
| a denial not thrown | 4 |
| a refused batch keeps its admitted members reserved | 1 |
| the wallet sends, not the guard | 2 |
| `signMessage` delegates to the wallet | 1 |
| the wrapped wallet exposed as a member | 1 |
| kit: returned signatures not verified | 1 |
| kit: the transaction's own expiry ignored | 1 |
| RPC client: an errored signature reported as landed | 1 |
| RPC client: bytes sent as hex, not base64 | 1 |

The RPC client was written before its test, and the last two rows show that test can fail.

## 4. Then, before devnet: a send's fate, and reads through a rate limit (D13)

Preparing the devnet runs on 2026-10-01 found two gaps in the send path, both fixed test-first.

**D13: a send of unknown fate was reported `failed`.** `guardedWallet` reported every rejected send `failed`.
`failed` frees the payment's value and ends the attempt, so a re-sign of it is admitted. A rejection is not always a
refusal:
- **A JSON-RPC error answer** means the RPC refused the bytes. With preflight on, it did not forward them.
- **A dropped connection, a timeout or an HTTP error** says nothing about whether the bytes reached a leader.

Reported `failed`, such a send freed a re-sign while the first copy could still land: the double-send intents exist
to stop.

**The fix:**
- `jsonRpc` throws `RpcRefused` (exported, `refused: true`) only for a JSON-RPC error answer.
- `guardedWallet` reports `failed` only for an error whose `refused` is true, and `unknown` for anything else.
  `unknown` keeps the payment in flight until its blockhash expires.
- A custom `RpcLike` marks a refusal the same way.

**Reads ride out a public RPC's rate limit:**
- `confirm` backs off and reads again after a failed read, until its deadline makes the outcome `unknown`.
- `getBlockHeight` tries up to five times with backoff, unless the RPC refused it.
- A send is never retried by the client.

Without these, `guardedWallet` failed closed whenever devnet answered a height read with HTTP 429. That was safe, and
it stopped a well-behaved agent.

**Failing first:**
- **Against a stub** (the `RpcRefused` class present, the old behaviour kept): `pass 12, fail 2`. The failures were
  the new unknown-send test and the RPC client's test.
- **The read-retry assertion** failed until reads were retried: `pass 13, fail 1`.
- **Two more planted bugs, both caught:** an HTTP error typed as a refusal; `confirm` stopping at the first failed
  read.

```
adapters.test.ts: ℹ tests 14   ℹ pass 14   ℹ fail 0
```

On devnet, the scenes' five payments and the Solana Agent Kit agent's whole transaction went through this path
([e2e/scenes-devnet.md](../e2e/scenes-devnet.md), [agentkit/sak-devnet.md](../agentkit/sak-devnet.md)).

## 5. Limits, stated

- **`guardedWallet`'s expiry is an upper bound:** the current height plus 150. A kit transaction's is exact.
- **These tests run against fakes, not a chain.** The wrapped wallet and the RPC are in-process stand-ins. A real
  Solana Agent Kit agent has since run on a local validator and on devnet ([agentkit/](../agentkit/)). A kit-signer
  agent has not.
- **A sign-only path learns no outcome by itself.** Through `signTransaction`, the wallet signs and the caller sends.
  That was D14, closed in [intents-d14.md](intents-d14.md). The guard now holds an unreported attempt's intent, and
  `guardedWallet` follows up what it signed. The follow-up lives in memory, so after a restart the hold lasts until a
  report or the window.
- **A wallet outside the guard is outside it.** `guardedWallet` stops what passes through it. Code that holds the raw
  wallet or key can still sign directly; that is why the signer process exists (Alpha, milestone 3.1).

## Regenerate

- `node --test packages/sdk/test/adapters.test.ts`
