# CI-2 — current source core qualification

2026-10-11 Toronto, revision 6c61cf3157be2f1b2c492b783287a7136400b640,
unchanged integrated D40 product. Builder-authored same-host Linux/Node 26.7.0
evidence; Node 24.19.0 is the already installed replay runtime. No source,
population, coefficient, deadline, floor or architecture decision changes.

Freeze product, test and CI inputs before measurement. Use fresh fixed seeds
101119 for fuzz and 101123 for properties with the unchanged domains. The actual
maintained fuzz gate completes one million inputs: 188,876 accepted and matched
kit; 811,124 refused with a named decoder rule. The selected fuzz case passes
without skips, cancellations or todo. This is synthetic mutated-message coverage,
not real-transaction differential or on-chain qualification.

All seven original source properties pass with 10,000 completed runs and zero
skips each: SOL per transaction/window, address encoding, legacy/v0/v1 message
decoding and resolution, and arbitrary-byte refusal. Both runtimes replay the
original mixed workload's 10,000 decisions and 13,651 entries to the pinned head
`cb4674cdc5851f2c1d6645df4c1d36f30eb7cf616b95010b27dbe6487c65254c`.
Neither replay timing nor a complete runtime matrix is claimed.

The maintained validator controls pass all fifteen cases, including reduced
budgets, failed/incomplete/duplicated fuzz evidence, changed replay heads, missing
workload kinds and property completion/fault-trial refusal. These are existing
maintained negative cases, not newly planted product mutations. All initial
historical gate-failure receipts remain unchanged. Typecheck passes.

```sh
SOLANAUT_FUZZ_SEED=101119 npm run test:fuzz
SOLANAUT_PROPERTY_SEED=101123 node --test packages/sdk/test/properties.test.ts packages/sdk/test/caps.property.test.ts
npm run test:replay
mise exec node@24.19.0 -- node evals/ci/replay.ts
node --test evals/ci/fuzz.test.ts evals/ci/properties.test.ts evals/ci/replay.test.ts evals/ci/property-trial.test.ts
npm run typecheck
```

Commands run sequentially in owned process groups with logs in .sandbox until
completion. All four jobs exit zero; process IDs, exact commands/environment and
source fingerprints are retained in `core-runtime/`. Every frozen input still
matches afterwards. No worker remains active. Failed-gate evidence from earlier
native/coverage/maintained campaigns is neither overwritten nor reclassified.

Node 22, full native/coverage/mutation/maintained/hosted CI, isolated signer,
bounded recovery, independent security, clean deployment, human usability and
stable-release qualification remain owed. These scoped passes do not waive H11,
H9/H10/H14/H15 or any R.1–R.5 requirement.
