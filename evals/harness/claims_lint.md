# claims_lint — every measured claim can be regenerated

`uv run --script tools/claims_lint.py`, 2026-10-01. Milestone 2b.2 in [docs/ROADMAP.md](../../docs/ROADMAP.md) asks
that every measured number have a row in [docs/CLAIMS.md](../../docs/CLAIMS.md) with its version, config and the
command that regenerates it. The version and config are judgement; the rest is now a gate, session-close gate 4b and a
CI step, shown failing before it was trusted.

## 1. On the claims as they stood: 11 errors

Run against `docs/CLAIMS.md` at `0e40972`, before any row changed:

```
ERROR  S3: measured, but names no command that regenerates it (`npm …`, `node …` or `uv run …`)
ERROR  S4: measured, but names no command that regenerates it (`npm …`, `node …` or `uv run …`)
ERROR  S4: measured, but names no receipt under evals/
ERROR  S4: measured, but says no date
ERROR  S6: measured, but names no command that regenerates it (`npm …`, `node …` or `uv run …`)
ERROR  S7: … S8: … S9: … S10: … S11: … S12: the same
claims_lint: 12 rows in §1, 11 error(s)
```

Nine of the ten measured rows cited their test file and receipt, and the receipts hold the commands. But a reader of
the claims list could not regenerate a number from the row itself, which is what 2b.2 asks. S4 also named no receipt
and no date. S1 was the one row that passed: it already named `npm run sandbox -- --cluster local`.

## 2. The self-test: seven planted faults, each caught

`uv run --script tools/claims_lint.py --selftest` lints a fixture in a temporary directory, once clean and once per
fault:

```
  [PASS]  clean   the clean fixture
  [PASS]  caught  a measured row with no command
  [PASS]  caught  a measured row with no receipt
  [PASS]  caught  a measured row with no date
  [PASS]  caught  a cited path that does not exist
  [PASS]  caught  an ID used twice
  [PASS]  caught  no §1 at all
  [PASS]  caught  a row missing its evidence
claims_lint selftest: 8/8
```

"No §1 at all" is the check that cannot see: it is an error, never a clean pass.

## 3. After: each command added, and each one run

Each measured row now ends with `Regenerate:` and its command, taken from its receipt. Every offline command was run
on 2026-10-01 before it was written into a claim:

| Row | Command | Result |
|---|---|---|
| S3 | `node --test packages/sdk/test/admission.test.ts packages/sdk/test/sensor.battery.test.ts`; `npm run sandbox` | 36 of 36; the sandbox's loop stopped at turn 3 |
| S4 | `node --test packages/sdk/test/admission.test.ts packages/sdk/test/keel.test.ts` | 46 of 46 |
| S6 | `node --test packages/sdk/test/durable.test.ts` | 11 of 11 |
| S7 | `node --test packages/sdk/test/sensor.battery.test.ts` | 2 of 2 |
| S8 | `node --test packages/sdk/test/drain.battery.test.ts` | 2 of 2 |
| S9 | `node --test packages/sdk/test/decode.test.ts` | 24 of 24 |
| S10, S11, S12 | the devnet commands in their receipts, with placeholders for the RPC and the keypair files | run on devnet earlier the same day ([agentkit/sak-devnet.md](../agentkit/sak-devnet.md), [onchain/squads-devnet.md](../onchain/squads-devnet.md), [e2e/scenes-devnet.md](../e2e/scenes-devnet.md)); not re-run here, which would spend devnet SOL |

```
claims_lint: 12 rows in §1, 0 error(s)
```

## Not checked

- **Whether the number in a row is the number the command prints.** The script checks that a command is named,
  not what it prints. Each receipt holds the printed numbers.
- **Versions and configs.** These are read by a person, at each milestone review.
- **§2 to §5** (Gubernaut's figures, others' facts, the claims not to make) are not measured by Solanaut, so they
  need no command. Their paths and IDs are still checked.
