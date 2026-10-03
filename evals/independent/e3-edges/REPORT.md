# E3 edges: the adapters, Keel and the sensor (black box)

> Written by the evaluator (claude-opus-5-5, a subagent given only `SPEC.md` and `API.md`) and saved here verbatim
> from its hand-back: its harness refused it the write. The triage is in [TRIAGE.md](TRIAGE.md), kept apart.

Evaluator: claude-opus-5-5. Inputs: SPEC.md (Draft 4, §1–§12; §13 ignored) and API.md only. 83 cases: **80 pass, 2 fail, 1 unclear**. The cases are in REPORT.json; the battery numbers are in results/batteries.json.

## Fails

**E78 · §8 all or nothing: a batch signed in place, partly returned, leaves sendable bytes behind.** The wallet signs both transactions in place but returns only the first. `signAllTransactions` throws `wallet-changed-message` and reports both decisions `expired`. Transaction 2 keeps a valid signature over its admitted message, and the guard then admits the same payment again. The caller holds signed bytes that can still land, while their intent and window reservation are free: a double payment. §8 says "expired" is for bytes that "were never signed, so they cannot land"; these were signed.

```js
// repro/e78.mjs (helpers from tests/helpers.mjs)
wallet.signAllTransactions = async (txs) => { for (const t of txs) await wallet.signTransaction(t); return txs.slice(0, 1); };
const txs = [tx(dest0, 1000n), tx(dest1, 2000n)];
await gw.signAllTransactions(txs);       // throws wallet-changed-message
txs[1].signatures[0];                    // still a valid signature over txs[1]'s admitted message
guard.entries();                         // decision, redeem, decision, redeem, report expired, report expired
guard.check({ message: payment(dest1, 2000n), at });   // allowed
```

**E22 · §8 `wallet-changed-message` carries a decision.** §8: "Two rules have no decision behind them: `message-signing-denied` and `wallet-changed-message`." `message-signing-denied` gives `decision: null` (E02). `wallet-changed-message` gives the admitted entry (`allow: true, seq: 0`), so code that reads `e.decision.allow` sees `true` on a denial.

```js
// repro/e22.mjs: the wallet signs with a key other than its own
await gw.signTransaction(tx);   // SolanautDenied wallet-changed-message, decision { allow: true, seq: 0 }
```

## Unclear

**E52 · §6 valence below -1.** After five failed outcomes, 0.2 − 0.3k gives −1.3, outside Keel's [−1, 1], so §6 D3 would deny every proposal as `fail-closed`. The guard clamps at −1 and keeps allowing. Is the clamp intended? If so, §6 should state it.

The other spec questions are in REPORT.json. They cover: whether the rate term counts the current proposal (it does), whether rule 18's amount includes fees (it does not), which objects count as "the caller's object", and that D4's swapped-module case could not be tested from here.

## Measured (batteries, no threshold)

- **Loop.** Identical failing retries stop at turn 3 (`loop-reground`). Rising fees stop at turn 4: by `intent-attempts-exhausted` at REGROUND with 3 attempts, by `loop-reground` with 50. Alternating two shapes is not stopped in 30 turns (INHIBIT from turn 13, amounts under the clamp). All three match §6.
- **Benign, constant fees.** 0 of 600 at 6 a minute (Poisson) and 0 of 600 in bursts (7.1 a minute). Wilson 95% CI 0–0.64% for each.
- **Benign, wallet-varied priority fees.** 15 of 3000 stopped: 0.50%, Wilson 95% CI 0.30–0.82%, seeds 3003–3007. Every stop was a REGROUND, read as "same shape at higher fees" (0.8) two or three times running, and each one latched the guard until the operator signed. §6's "0 of 600" holds only for constant fees.

## Last 15 lines of the run

`node --test tests/` does not run on Node 26.7.0: the runner takes the directory as a module path and fails with MODULE_NOT_FOUND. The suite was run as `node --test tests/*.test.mjs`. The summary was `tests 83 · pass 81 · fail 2` (E52 passes as a test; its verdict is unclear). Stack-trace lines are filtered out; the full output is in results/full-run.txt.

```
  AssertionError [ERR_ASSERTION]: signed bytes left on caller objects 1 (valid: 1); decisions: seq 0: expired; seq 2: expired
  + actual - expected

  + [
  +   1
  + ]
  - []

    generatedMessage: false,
    code: 'ERR_ASSERTION',
    actual: [ 1 ],
    expected: [],
    operator: 'deepStrictEqual',
    diff: 'simple'
  }
```
