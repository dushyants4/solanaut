# RT-1/RT-3 — current synthetic traffic and loop limits

2026-10-11 Toronto, revision 7fd964b5314814e46cbcb1d7a684f467a63c17b7,
unchanged D40 product, Linux/Node 26.7.0. Builder-authored local evaluation,
not outside-user, independent security or chain evidence.

Freeze current source and the original traffic definition before measurement.
Reproduce definition one with its original domains, seeds, policy and horizon;
no controller coefficient, workload, threshold or gate changes. Reusing this
frozen population is not an additional independent statistical sample.

The five original benign profiles each complete 500 proposals, all allowed:
2,500 completed proposals and zero synthetic false stops. The maintained
upper95 estimator returns 0.0015342823603537858 as a fraction. Histories
reconcile decisions and outcomes. This is the defined synthetic population,
not a measured false-stop rate for deployed users or arbitrary traffic.

Loop findings are retained at the same weight as benign passes:

| Original stream | First refusal | Rule / limit |
|---|---|---|
| Identical | proposal 3 | loop-reground |
| Escalating | proposal 4 | intent-attempts-exhausted |
| Alternating | none in 60 proposals | all allowed; INHIBIT does not deny these proposals |
| Distinct failed outcomes | none in 60 proposals | all allowed; outcome variation avoids the effects retry limit |

These reproduce the previously known RT-3 limits. No promise to stop every
alternating or failed-outcome loop follows from the two stopped streams. A
redesign needs accepted architecture and fresh definitions/seeds before
evaluation; Codex neither tunes against these results nor widens a claim.

```sh
npm run test:traffic
node --test evals/ci/traffic.test.ts evals/ci/traffic-run.test.ts evals/ci/traffic-workload.test.ts
npm run typecheck
```

All thirteen original traffic/domain/validator cases pass without skips,
cancellations or todo. Typecheck passes and every frozen input hash matches
afterwards. Exact raw loop postures/results, definition and complete control
outputs are retained in `current-traffic/`; earlier failures stay unchanged.
The benign gate's success does not qualify the non-stopping loop behaviours,
full CI, deployment, independent review or any stable-release milestone.
