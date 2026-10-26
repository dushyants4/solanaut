# @solanaut/sdk

The guard: a deterministic transaction policy, plus [Gubernaut Keel](https://www.npmjs.com/package/@gubernaut/core)'s
loop brake, between an AI agent and its key. The agent proposes the bytes it wants signed; the guard decides by a
policy the operator wrote, records the decision, and only an allowed decision can be signed.

It is not published to npm. Inside this repository, npm workspaces resolve `@solanaut/sdk` to this folder's TypeScript
source, which Node runs as it is (22.18 or later; 26.7.0 is the pinned version). To try the compiled package in a
project of your own, follow [docs/PREVIEW.md](../../docs/PREVIEW.md).

```ts
import { createGuard } from "@solanaut/sdk";

const guard = await createGuard({ policy });

const decision = guard.check({ message, at: Date.now(), blockHeight, lastValidBlockHeight });   // heights are bigints
if (decision.allow) {
  const receipt = guard.redeem(message, decision.hash, blockHeight);
  if (receipt.ok) {
    // sign and send exactly `message`
    guard.report(decision.hash, "landed");
  }
}
```

[`examples/guarded-payment.mjs`](../../examples/guarded-payment.mjs) is the whole of it, offline. The adapters take
these steps for you: `guardedWallet` for Solana Agent Kit, and `guardedSigner` for `@solana/kit`. The guide and the
full reference are in [docs/SDK.md](../../docs/SDK.md).

## What is where

Read [`src/index.ts`](src/index.ts) first: it lists every export, grouped by purpose. Then:

| File | What it does |
|---|---|
| [`src/guard.ts`](src/guard.ts) | `createGuard`: message bytes in, a decision out, by rules 0 to 19 in order; receipts, reports, the latch, replay |
| [`src/policy.ts`](src/policy.ts) | policy v1: validated once, frozen and hashed |
| [`src/message.ts`](src/message.ts) | message bytes read without a library: legacy, v0 and v1 |
| [`src/classify.ts`](src/classify.ts) | what a message does, from its bytes alone: outflows, fees, denied instructions, the intent key |
| [`src/sensor.ts`](src/sensor.ts) | the proposal stream turned into Keel's three numbers |
| [`src/state.ts`](src/state.ts), [`src/log.ts`](src/log.ts) | the guard's state, changed only by applying an entry of its hash-chained record |
| [`src/record.ts`](src/record.ts) | where the record lives: memory, or a synced, locked file |
| [`src/latch.ts`](src/latch.ts) | the release text the operator signs to free a latched guard |
| [`src/errors.ts`](src/errors.ts) | `SolanautDenied`: what the agent is told, and what only the operator sees |
| [`src/adapters/`](src/adapters/) | `guardedWallet`, `guardedSigner`, `jsonRpc` and the signer's sending client |
| [`src/signed-policy.ts`](src/signed-policy.ts), [`src/profile.ts`](src/profile.ts) | policies the operator signs, and the evaluator identity a signed history binds |
| [`src/base58.ts`](src/base58.ts), [`src/pda.ts`](src/pda.ts), [`src/tables.ts`](src/tables.ts) | addresses, offline: base58, program-derived and token accounts, lookup-table pins |
| [`src/canonical.ts`](src/canonical.ts) | canonical JSON, so equal values hash the same |
| [`src/request.ts`](src/request.ts), [`src/control-request.ts`](src/control-request.ts), [`src/signing.ts`](src/signing.ts), [`src/authority.ts`](src/authority.ts) | the signer host's request identities, signing journal and attribution |
| [`src/inspect.ts`](src/inspect.ts) | `inspectRecord`: what a dashboard shows of a guard, computed from its record as a restore would |
| [`src/archive.ts`](src/archive.ts) | verifying a stopped record's archive |
| [`src/checkpoint.ts`](src/checkpoint.ts), [`src/checkpoint-archives.ts`](src/checkpoint-archives.ts) | a checkpoint's signed binding, and the catalogue of archives it names |
| the other `src/checkpoint-*.ts`, `src/request-index*.ts`, `src/owned-guard.ts` | internal parts of the signer host's recovery path, not exported |
| [`bin/`](bin/) | the commands: `replay`, `pin-table`, `verify-archive`, `prepare-policy`, and the release build |
| [`test/`](test/) | the batteries, run with `node:test` |

## Commands

From the repository root:

```bash
npm test                                         # every battery
npm run typecheck                                # tsc, no emit
npm run replay -- <record.jsonl> <policy.json>   # recompute a record's decisions; exit 1 at the first divergence
npm run pin-table -- --url <rpc> <table>         # a lookup table's pin for the policy
npm run verify-archive -- <archive.jsonl>        # check a stopped record's framing and hash chain
npm run prepare-policy -- <policy.json> --version 2 --issued 2026-10-27T00:00:00.000Z   # the text an operator signs
npm run release:prepare                          # stage the compiled package in .sandbox/releases/sdk
```

The code is written to [STYLE.md](../../STYLE.md). Its one runtime dependency is `@gubernaut/core` 1.0.1, pinned and
checked by its bytes when a guard starts.
