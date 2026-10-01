# D14: an attempt nobody reported may have landed

A defect in the intents ([docs/SPEC.md](../../docs/SPEC.md) §7 and §10), found on 2026-10-01 after the devnet runs and
closed the same day, test-first.

## The defect

Intents exist so a payment is not signed again while an earlier attempt at it could still land (rule 14,
`intent-in-flight`). The rule asked whether an attempt **could still land**: was its outcome open, and was the block
height at or below its last valid height? Past that height, an attempt nobody had reported counted as gone, and a retry
was admitted.

But an unreported attempt past its last valid height either landed or never will. The rule read it as "never will".

**Who never reports: any sign-only integration.** The wallet signs, and the caller sends. Through
`guardedWallet.signTransaction` nothing told the guard what happened. A retry of a payment that had landed unreported
was admitted once the blockhash expired, and could pay twice. It was bounded only by the attempts cap, the window caps
and Keel.

**Why it surfaced now.** On devnet, Solana Agent Kit 2.0.10 told its agent that payments which had landed had failed
([agentkit/sak-devnet.md](../agentkit/sak-devnet.md)). That is the message that invites a retry.

**Confirmed offline first:**

```
1. pay 0.1 SOL; signed; sent by the caller; lands; nobody reports      ALLOW
3. the same, 90 s later, height 1,151: past the first's last valid one  ALLOW   ← the defect
```

The SPEC's double-send battery had specified that second line as "re-sign after expiry: allowed".

## The fix

- **The rule** (`state.ts` `unresolved`, `guard.ts` rule 14). An attempt still `pending` or `unknown` holds its intent at
  any height. Its reason names the case: "past its last valid block height, but its outcome was never reported, so it
  may have landed". The hold lasts until a report says `landed`, `failed` or `expired`, or until the window has passed
  since the intent's first attempt. Meanwhile the window caps count the attempt. So a recurring payment can still pay
  again a window later.
- **The adapter** (`guardedWallet`). What it only signs, it now follows up, and the same for what it sent without
  learning the outcome. Before the next proposal is checked:
  1. it reads the block height;
  2. it asks the RPC for each such signature's status, with history searched;
  3. **seen landed or failed:** it reports that;
  4. **unseen, with the height already past the attempt's last valid one:** it reports `expired`, because the attempt
     can never land and did not;
  5. **seen but not yet confirmed:** it waits.
- **The RPC client** (`jsonRpc`).
  - **`getSignatureStatus`**, an optional `RpcLike` member, does that lookup. Without it, the guard simply holds the
    intent, which is safe.
  - **`confirm` reads the height before the status.** Read the other way round, a payment processed at its last valid
    height could be called `expired`: its status read as merely processed, then the height read as past. That false
    "never landed" belongs to the same defect, so it was closed here too.

## Failing first

Against the old code, the new and changed tests failed: `pass 45, fail 5`.
- the double-send battery, with its D14 line;
- a D14 test of the rule;
- two of the adapter's follow-up;
- the RPC client's test: a payment processed at its last valid height, and the lookup's history search.

**One test was wrong, not the code.** The first adapter test expected a hold at height 1,151, which is already past the
attempt's last valid height of 1,150. The follow-up rightly reported it `expired` there, so the hold is now tested at
exactly 1,150. The same test then met Keel: the same payment, retried after a denial and an expiry, scored repetition 1
and valence −0.4, and was stopped as `loop-reground`. The test now checks what it is for, that the expired report freed
the intent, and leaves the retry's posture to Keel.

**Then passing:**

```
admission.test.ts + adapters.test.ts: ℹ tests 50   ℹ pass 50   ℹ fail 0
npm test:                             ℹ tests 152  ℹ pass 152  ℹ fail 0
npm run replay -- .sandbox/devnet/guard.jsonl …: replays: 27 entries, 13 decisions recomputed, no divergence
```

The devnet scenes' record, made before the fix, replays unchanged under it: none of its attempts was left unreported
past its expiry.

## Seven planted bugs, seven caught

| Planted bug | Caught by |
|---|---|
| an `unknown` outcome counted as resolved | the double-send battery |
| rule 14 ignores unresolved attempts past expiry | 3 tests |
| the follow-up: unseen means expired, whatever the height | the follow-up test |
| the follow-up: seen but unconfirmed means expired | the pending test |
| sign-only attempts never followed up | the follow-up test |
| `confirm`: a processed signature past the height called expired | the RPC client's test |
| the status lookup does not search history | the RPC client's test |

## Limits, stated

- **The follow-up lives in the adapter's memory.** After a restart, an attempt left unresolved holds its intent until
  someone reports it, or until the window passes. The record does not carry signatures, because the guard never sees
  them.
- **A caller outside `guardedWallet` must report.** `guardedSigner`, the kit signer, only signs and has no RPC. Its
  integrator reports outcomes with `guard.report`, or the hold lasts the window.
- **An RPC that loses history could report a landed payment `expired`.** The lookup searches history, and the height
  is read first. A node far behind the cluster is outside what this can see.

## Regenerate

`npm test`; the planted bugs are reproduced by editing the lines named in the table, one at a time.
