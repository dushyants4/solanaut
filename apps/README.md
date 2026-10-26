# apps

Programs built on the SDK in [`packages/sdk`](../packages/sdk/). Each one either shows the guard at work or
tests it against a real cluster. Run them from the repository root, after `npm install`.

| App | What it is | Run it |
|---|---|---|
| [`sandbox/`](sandbox/src/main.ts) | three scripted streams through the guard: ordinary payments, a drain, a retry loop | `npm run sandbox`, offline; or `npm run validator`, then `npm run sandbox -- --cluster local` |
| [`cockpit/`](cockpit/src/server.ts) | the dashboard: a guard's record and its Squads limit, read-only, on 127.0.0.1, holding no keys | see below |
| [`agentkit/`](agentkit/src/run.ts) | a scripted Solana Agent Kit agent that adopts the guard by one changed line | `node apps/agentkit/src/run.ts --url http://127.0.0.1:8899`, against a local validator |
| [`onchain/`](onchain/src/) | the devnet scripts: `squads.ts`, a stolen-key drill against a Squads v4 spending limit, and `scenes.ts`, the demo's scenes end to end | the commands are in each file's header; they need funded devnet keys |
| [`signer/`](signer/src/) | the separate signer process: holds the key, owns the record, answers `propose`, `report` and `status` on a Unix socket | a development build, same-user only: [docs/SIGNER.md](../docs/SIGNER.md) |
| [`firewall/`](firewall/src/filter.ts) | the MCP firewall's first part: which tool calls may reach a wallet at all | not yet a program; its tests run in `npm test` |

## The dashboard, offline

`demo.ts` writes a policy and a short record (payments that land, a drain, a re-send while the first is in flight, a
durable nonce, garbage bytes, an over-cap payment). The cockpit then shows it:

```bash
key() { node -e 'console.log(require("@solana/web3.js").Keypair.generate().publicKey.toBase58())'; }
node apps/cockpit/src/demo.ts --dir .sandbox/cockpit --agent "$(key)" --treasury "$(key)" --operator "$(key)"
npm run cockpit -- --record .sandbox/cockpit/guard.jsonl --policy .sandbox/cockpit/policy.json
```

Open <http://127.0.0.1:8787>. Nothing is signed or sent; the keys are public keys only.

The cockpit, signer and firewall have tests in their `test/` folders, run by `npm test`. The evidence from the devnet
runs is in [`evals/`](../evals/README.md).
