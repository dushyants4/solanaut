# Plan: reshape Solanaut's code the way DHH would (2026-10-22)

> Approved by the human on 2026-10-22 and carried out from then to 2026-10-26: `runs/2026-10-26-dhh-reshape.md`.

## Context

The human asked for better code shape, following DHH's principles, pushed to GitHub when done. The target is this
folder, the public snapshot at `55e31b9` (`github.com/dushyants4/solanaut`), which judges are reading for the
Crypto World's Fair. Judging (§8) scores "functionality (and code quality)". The commits will be dated after the
2026-10-12 close and will be visible to judges. That was the human's decision, made on 2026-10-22.

The code is correct and heavily gated, but much of it is hard to read:
- whole files written minified;
- `createGuard` is 263 lines long;
- single-letter names everywhere;
- ticket-code comments;
- helpers placed above the public entry points.

The goal is code a judge can read top-down like prose, with **no change in behaviour**. Two facts come first:
- **CI on public `main` is red today.** The test jobs run past their 10-minute limit on Node 22.18, 24 and 26.7.
  The coverage job fails. Fault partitions 1 and 2 fail on `packaging/faults.ts` and
  `checkpoint-publication-faults.ts`.
- **The Agent Kit demo is broken.** On the judge's path, `apps/agentkit/src/run.ts:80` prints `DENIED: undefined`,
  because `SolanautDenied.rule` is only filled under full disclosure (ADR-025). The receipt
  `evals/agentkit/sak-local.md:24` shows `DENIED: destination-not-allowed`.

## How DHH would work this

Sources: the Rails Doctrine, 37signals' `STYLE.md` (Fizzy), "Fractal journeys", "Vanilla Rails is plenty",
"Clarity over brevity in variable and method names", and "Test-induced design damage".

- **Exalt beautiful code.** Readability is the deliverable, not decoration.
- **Convention over configuration.** Write the house style down once (`STYLE.md`) and apply it everywhere. No
  file is a snowflake.
- **Fractal journeys.** A high-level function tells the story in domain words and delegates to named steps. Each
  function works at one level of abstraction. `evaluateRules` should read as the 19 rules, in order.
- **Clarity over brevity.** Write `effects`, `totals`, `decision`, `limit` and `token`, never `e`, `t`, `d`, `l`
  or `x`. If the names are good, comments are needed only for *why*.
- **Expanded conditionals and invocation order.** Avoid nested ternaries. Use guard clauses only at the top of a
  function. Put the public entry first and its helpers below it, in the order they are called.
- **Rich model, no needless layers.** Nothing is added for testing's sake. No abstraction without a second
  caller. Repeated concepts get one name.
- **Pragmatism.** The majestic monolith: large files are fine when organised, so nothing is split. Progress comes
  in shippable slices, each one green and pushed.

## Invariants (the gates prove each one)

- **Bytes unchanged:**
  - every string literal in product source (reasons, errors, output);
  - object-literal key order;
  - every canonical key.
  - So record bytes, decision hashes, `evals/ci/replay.ts`'s `EXPECTED_HEAD` and the differential digests stay
    the same.
- **No exported name changes,** public or internal: 87 test and eval files import internals. The private names
  that docs cite (`evaluate`, `reapply`) also stay.
- **No file renamed, moved, split or merged.** Three things are keyed to files:
  - `MUTATION_PATHS`, asserted word for word in `npm test`;
  - coverage's 24 critical files;
  - bite's `CAMPAIGNS`.

  Moving code into a new file would silently take it out of the mutation and per-file coverage gates.
- **No test file changes.** About 45 campaigns assert test counts.
- **Fault sites change with the code.** Every fault site is rewritten in the same commit as its code. Each fault
  keeps its name and its exact meaning. Each rewritten faulted source must still parse, because a syntax error
  would "catch" itself. No fault, floor or limit is removed.
- **Signer budget.** It stays at or under 1,000 lines (ADR-021; 623 today), counted by its own `wc -l` command.
- **Hoisting.** Helpers moved below their callers become `function` declarations, never `const` arrows evaluated
  at load.
- **One fixed string.** `if (problems.length)` appears exactly once in `policy.ts` (`mutation-stage.test.ts`).

## Slices: one commit each, pushed when green (standing rule 7)

0. **Baseline.** Run every gate locally at `55e31b9` and record the "before" in the run record:
   - `npm test`, `typecheck`, `release:prepare`, `test:package`, `test:package:faults`, `test:latch:faults`;
   - `test:bite` (all three partitions);
   - `test:coverage -- --serial`, `test:replay`, `test:differential`, `test:fuzz`, `test:kills`,
     `test:traffic`.
1. **CI green, time-boxed** (operator, `.github/workflows/ci.yml`). Diagnose the four red jobs from
   `gh run view --log-failed` and local timings. Fix real defects. Change a time limit only with measured
   evidence, never by lowering a floor or dropping a fault. If a cause needs more than a bounded fix, record it in
   `runs/` and move on. Push, then watch the run.
2. **Conventions and the demo fix.**
   - Add a root `STYLE.md`: the rules above, as the house style for TypeScript here.
   - Add a one-line pointer to it in `CLAUDE.md` and `AGENTS.md`.
   - Fix `run.ts:80`: recover the rule from the guard's record by `e.ref`, as `apps/onchain/src/scenes.ts:149`
     already does, falling back to `e.class`.
   - Verify on `npm run validator` against `sak-local.md`'s output.
3. **Front door** (no fault sites):
   - `examples/offline-preview.mjs`, `apps/sandbox`, `apps/agentkit`, `apps/onchain`, `apps/cockpit`;
   - `packages/sdk/src/index.ts`: group the exports by domain, and keep the `export … from` line form that
     `checkpoint-faults` matches.
   - Rename `sol()` per direction (`lamportsToSol` / `solToLamports`). Demo policies stay self-contained, for
     didactic reasons.
4. **The heart: `guard.ts`** (~79 sites):
   - order: types, `createGuard`, `replay`, then rule evaluation, Keel verification and helpers;
   - `evaluateRules` as the rule sequence of named checks;
   - `createGuard` as named steps: open the record, restore, check the policy version, then the verbs;
   - merge the identical `controlReply` and `admissionReply`;
   - name the inline shapes and the locals.
5. **The domain model:**
   - `policy`, `classify` (named steps for System, Token and ComputeBudget), `state` (the `apply` switch as named
     cases), `log`;
   - `errors`, `message` (light);
   - `signing`, `signed-policy`, `request`, `control-request`, `authority`, `latch`, `sensor`, `tables`, `pda`,
     `inspect`, `profile`.
6. **Adapters:** `agent-kit`, `kit`, `rpc`, `sending-client`.
7. **The record** (the worst-shaped files; ~200 sites): `record`, `archive`, `owned-guard`, `request-index`,
   `request-index-publication`. Within-file duplication gets one name.
8. **Checkpoints:** the nine `checkpoint-*.ts` files (~145 sites).
9. **The signer and the firewall:** `apps/signer/src`, `apps/firewall/src` (61 sites; report the budget count).
10. **The command-line tools:** `packages/sdk/bin` (33 sites).

**The loop in each slice:**
1. Reshape to `STYLE.md`.
2. `npm run typecheck && npm test`.
3. Find every campaign that names the files, `.py` and `.mjs` included:
   `grep -rl '<path>' evals --include='*faults*'`. Run each one, and rewrite each "missing fault site" to the
   reshaped text with the same mutation.
4. For SDK slices: `release:prepare`, `test:package`, `test:package:faults` (fixing compiled-output sites the same
   way), and `test:latch:faults`.
5. `test:replay`, `test:differential`, `test:coverage -- --serial`.
6. Read the whole diff, commit (`area: reshape … for reading, behaviour unchanged, …`), push, check CI.

Before pushing slices 4, 7, 8 and 9, a single `solanaut-evaluator` agent compares the old and new version of every
rewritten fault, to confirm each one applies the same mutation. Each faulted source is also parsed by a
scratchpad script.

## Close

1. Run every gate from slice 0 again, and compare against the baseline.
2. Bring `docs/OVERVIEW.md` up to date wherever its prose names reshaped code.
3. Write `runs/2026-10-26-dhh-reshape.md`: before and after, sites rewritten, the signer count, and what CI
   shows. Update `PROGRESS.md`.
4. Run `uv run --script tools/session_close.py` until it is green, then push.
5. Record in the agent's memory that on 2026-10-22 the human asked for the public snapshot to be polished, here.

## Verification

- All the slice-0 gates are green, or exactly as red as the baseline, with the reason written down.
- The replay head and the differential digests are unchanged, which shows the bytes are unchanged.
- `npm run sandbox` and `npm run sandbox -- --cluster local` give the same output as before.
- The Agent Kit run on a local validator prints rule names.
- CI on the final push is checked with `gh run watch`.
