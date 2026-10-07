# CI-2 — strict serial coverage execution

2026-10-07 · builder-authored local Linux evidence, Node 26.7.0.
The default scheduler is unchanged. A single `--serial` selects Node's one-process test
scheduling; unknown, repeated or filtering options refuse before measurement. The complete
root test population, source inventory, AST instrumenter and fixed coverage floors are
unchanged. Execution arguments are recorded in the measurement summary. This execution
control does not establish timing, mutation score or security qualification.

All three parser cases fail against the stub (`../sdk/checkpoint/coverage-options-red.txt`).
Three real faults are caught and source restores (`coverage-options-faults.txt` in that
directory): changed default, serial scheduling of two processes and arbitrary option
passthrough. The maintained inventory rejects the unregistered campaign
(`coverage-inventory-red.txt`). After registration, eleven parser/coverage/inventory cases
pass (`coverage-options-final.txt`); typecheck passes (`typecheck-serial.txt`).

Regenerate with `node --test evals/ci/coverage-options.test.ts evals/ci/coverage.test.ts evals/ci/bite.test.ts`,
`node evals/ci/coverage-options-faults.ts`, `npm run typecheck` and
`nice -n 19 npm run test:coverage -- --serial`.

The earlier pre-bound-fix instrumented candidate passes 499 cases and every existing floor
(`../sdk/checkpoint/coverage-measurement.txt`, `coverage-summary.json` in that directory).
SDK statements 1,965/2,058; branches 1,613/1,744. Signer statements 466/487; branches
334/354. Checkpoint statements 56/56 and branches 70/70; every designated critical file
passes. The summary binds exact source hashes and records `--test-concurrency=1`.
No floor, population, instrumentation or production semantics changed for serial execution.
The full isolated fault campaign remains pending. Stryker shares this host; neither this
execution nor its duration is performance or independent security evidence.

After the bounded-key fix and fault-diagnostic addition, the complete current population
passes 504 cases and every unchanged floor (`../sdk/checkpoint/coverage-final-current.txt`,
`coverage-final-summary.json` in that directory). SDK statements 1,963/2,056 and branches
1,612/1,743; signer 466/487 and 334/354; checkpoint 54/54 and 69/69. The same source-hash
and execution-argument checks apply. The final current isolated aggregate exits zero: thirty-five campaigns, 315 caught-fault
lines, all 715 inputs and all 65 compiled files restored with exact release inventory
(`../sdk/checkpoint/isolated-bite-final-current.txt`, `final-restoration.json`).
Hosted candidate CI and private close follow.
