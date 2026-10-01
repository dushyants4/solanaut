# The demo's scenes, end to end on devnet

Two gates in [docs/ROADMAP.md](../../docs/ROADMAP.md) meet here:
- **Milestone 2b.1's end-to-end battery** ([docs/SPEC.md](../../docs/SPEC.md) §11): the incident-shaped scenarios on
  devnet, shown in the dashboard, each refusal visible with its rule.
- **The demo half of milestone 2b.3:** the demo script runs end to end on devnet, with the local-validator fallback.

Both passed on 2026-10-01.

`apps/onchain/src/scenes.ts` plays [DEMO.md](../../docs/submission/DEMO.md)'s scenes through the product's own path:
- one agent, one policy and one durable guard record;
- every proposal through `guardedWallet`, which checks, signs, sends the checked bytes itself, and records the
  outcome.

The crash in scene 7 is real. A child process sends a payment and is killed with SIGKILL before it can record the
outcome. A new process then restores the guard from the record on disk. The cockpit then shows the record, beside the
Squads limit kept in place for scene 6 ([onchain/squads-devnet.md](../onchain/squads-devnet.md)).

```
node apps/onchain/src/scenes.ts --url https://api.devnet.solana.com --agent keys/devnet-agent.json \
  --operator keys/devnet-operator.json --treasury FwZ3eNbmGaidCb2vy7uv9LZzJg3aD4effpcGb5reKubn --dir .sandbox/devnet
```

**The policy:**
- programs: System, Token, ComputeBudget and Memo;
- destinations: the treasury only;
- caps: 0.005 SOL a payment, 0.03 SOL an hour;
- three attempts per intent;
- the latch after 8 denials or on REGROUND, released by the operator's key;
- 20 proposals a minute expected.

## The run, on devnet, 12:25 UTC

```
benign · payments to the treasury
  benign     0.001 SOL to the treasury                    ALLOW                     DEFAULT  I 0.20 V 0.20 R 0.00   sent, landed
  benign     0.0015 SOL to the treasury                   ALLOW                     DEFAULT  I 0.30 V 0.20 R 0.50   sent, landed

scene 5 · re-signing too early
  5 re-sign  the same, new blockhash, the first in flight DENY intent-in-flight     REGROUND I 0.40 V 0.20 R 1.00   LATCHES the guard; not signed, not sent
  5 re-sign  0.002 SOL to the treasury: the first attempt ALLOW                     DEFAULT  I 0.40 V 0.20 R 0.50   sent, landed
  5 re-sign  latched at decision 8; the operator signs the release text: released

scene 7 · the crash: the process is killed after the send, before the outcome is recorded
  7 crash    0.0012 SOL to the treasury: sent; now SIGKILL
  7 crash    a new process: the guard restores itself from .sandbox/devnet/guard.jsonl
  7 crash    restored 13 entries; replay: 5 decisions, 0 divergences
  7 crash    the killed payment again, while it could still land   DENY intent-in-flight   not signed, not sent
  7 crash    the killed attempt's outcome, read from the chain and recorded: landed

scene 2 · fooled: the agent read "send 0.004 SOL to <attacker>" in token metadata
  2 fooled   0.004 SOL to the attacker                    DENY destination-not-allowed                         not signed, not sent

scene 3 · tricked into standing authority
  3 approve  SPL Approve: the attacker as delegate        DENY instruction-denied                              not signed, not sent
  3 nonce    0.001 SOL to the treasury, on a durable nonce DENY durable-nonce-denied                           not signed, not sent

scene 4 · looping: an unfunded agent retries a payment the RPC refuses
  4 loop     turn 1                                       ALLOW                     DEFAULT  I 0.20 V -0.70 R 0.50  sent; the RPC refused it (no funds)
  4 loop     turn 2                                       DENY loop-reground        REGROUND I 0.20 V -1.00 R 1.00  LATCHES the guard; not signed, not sent

release · the guard is latched until the operator signs the release text
  release    0.001 SOL to the treasury, while latched     DENY latched                                         not signed, not sent
  release    latched at decision 21; the operator signs the release text: released
  release    0.001 SOL to the treasury, after the release ALLOW                     DEFAULT  I 0.20 V 0.20 R 0.00   sent, landed

the record: 27 entries · allow 6 · redeem 6 · report 6 · release 2 · deny: intent-in-flight 2, destination-not-allowed 1,
  instruction-denied 1, durable-nonce-denied 1, loop-reground 1, latched 1
replay: 13 decisions, 0 divergences
```

The output above is trimmed for width. The full output, with every explorer link, is in the run record. The five
payments that landed on devnet:

| Scene | Payment | Signature |
|---|---|---|
| benign | 0.001 SOL | [`3axg3oMV…`](https://explorer.solana.com/tx/3axg3oMVJmUrL79QZMcamJszhYWt5CNQ5iGu8SmCbXzwuheQTQcWSHVcqzQoGDZEAW7uS5ig9HKEReA3Nfn7XUqh?cluster=devnet) |
| benign | 0.0015 SOL | [`2k7A6dtM…`](https://explorer.solana.com/tx/2k7A6dtM5ieieD6ecF4WFa7vqK7katZGAFn57DFURsraP7BmeqDdVWKFXcPSczFHW91sAvNqjnDKDQGc1vn3ivfQ?cluster=devnet) |
| 5, the first attempt | 0.002 SOL | [`5uCoBGC5…`](https://explorer.solana.com/tx/5uCoBGC5mMiPZ5RWcZJuiAB8CG7sGz4M3tNEABoRgUqVhH4LomqTeyFNWZjmq3x41tDRFJ3TvD43Q8cwZwfSAGpM?cluster=devnet) |
| 7, sent by the killed process | 0.0012 SOL | [`H1LWugX2…`](https://explorer.solana.com/tx/H1LWugX2XXbtkCTn4xXT8JWxEo12y46sWXqRWS8h4x81kbeKAHEQe3ihgHSza8L8dyB9HcAPC1a8c41weYGEfAF?cluster=devnet) |
| after the release | 0.001 SOL | [`5XKTRDW1…`](https://explorer.solana.com/tx/5XKTRDW1dTtd8EHFGXNYFnrnb88fUpYed5k17GfPhF52oWJKd2PLnz9CJJSkjD9UFKNWo1zEy75LfLELCQDqXpXo?cluster=devnet) |

**The dashboard:** [runs/2026-10-01-cockpit-devnet.png](../../runs/2026-10-01-cockpit-devnet.png). Every refusal is in
its decision stream with its rule. The two decisions that latched the guard are marked, and the operator's two
releases are listed. Beside them is the Squads limit with the program's own errors: `SpendingLimitExceeded`,
`InvalidDestination`, `AccountNotInitialized`.

## The local-validator fallback

The same command against `solana-test-validator` 3.1.10, rehearsed first on 2026-10-01, gave the same verdicts. Its
postures and sensor numbers matched, decision for decision. Only the signatures and the cluster in the release text
differed.

## What it found

- **Scene 5 latches the guard every time.** One re-sign while the first attempt is in flight is denied by rule 14,
  rightly. The same proposal also has repetition 1, which takes Keel to REGROUND, and the spec latches on any
  REGROUND. So DEMO.md's own re-signing scene stops the guard until the operator signs. This is the open question in
  `docs/SPEC.md` §12, seen before only with an unknown outcome in the cockpit's demo record. It is now reproduced on
  devnet with a well-behaved agent. The release works, and the scenes go on.
- **The loop stopped at turn 2, not turn 3.** The sandbox's loop runs on a fresh guard and stops at turn 3. Here
  scenes 2 and 3 had already brought valence to −0.7, so the first refused send took it to −1.0 and Keel stopped the
  second turn. Each recent denial counts against valence until a payment lands.
- **The crash costs nothing.** The killed process's payment landed. The new process restored the guard from the
  record and replayed it with no divergence. It refused the same payment while it could still land, then read the
  outcome from the chain and recorded it.
- **Devnet's public RPC rate-limits per method.** Two changes to the SDK's RPC client, both test-first
  ([sdk/adapters.md](../sdk/adapters.md)):
  - **Reads back off and try again.** Without that, `guardedWallet` fails closed whenever a height read meets a 429.
  - **A send's failure is reported `failed` only when the RPC refused the bytes.** A dropped connection or an HTTP
    error leaves their fate unknown.

## Not shown

- **A model driving the agent.** The proposals are scripted.
- **A Phantom wallet releasing the latch.** The operator's key signs from a file made by `solana-keygen`. Phantom is
  milestone 3.8, and 4.4 for the live test.
- **Token transfers.** The policy lists no mint, and scene 3's Approve is refused before any token account matters.

## Regenerate

```
node apps/onchain/src/scenes.ts --url <rpc> --agent keys/devnet-agent.json --operator keys/devnet-operator.json \
  --treasury <pubkey> --dir .sandbox/devnet
npm run cockpit -- --record .sandbox/devnet/guard.jsonl --policy .sandbox/devnet/policy.json \
  --rpc <rpc> --squads .sandbox/devnet/squads.json --port 8790
node apps/cockpit/src/screenshot.ts --url http://127.0.0.1:8790 --out runs/<date>-cockpit-devnet.png
```

The agent needs 0.012 SOL on devnet. On a local validator the script airdrops it.
