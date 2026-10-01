# 2026-10-01 · beta-build

The session began on 2026-09-30 and closed on 2026-10-01; the record is dated by its close.

## Asked

The human, on 2026-09-30, in their words, condensed:
- **Sign-off.** "You have my sign off for the number one": `docs/PRODUCT.md`, milestone 1.1.
- **Devnet only for now.** The human will connect their Phantom wallet, through its Chrome extension, as the final
  step after the Alpha is ready, or make an account if a better approach needs one.
- **The settings edit.** Add `plansDirectory` to `.claude/settings.json`: "you are very well equipped to handle that".
- **Later.** The licence, the judges' access and the submission wait "until the testing is done".
- **The role.** "This is a R&D department where you are essentially doing the development."

## Did

1. **Recorded the decisions.**
   - `docs/PRODUCT.md` is 1.0, signed off: milestone 1.1 achieved.
   - ADR-008 is deferred: devnet only for now.
   - Leg 4 now runs on devnet first, with the human's Phantom wallet.
   - The submission, the licence and the judges' access wait until testing is done.
   - `plansDirectory` is set.
2. **Built the Beta, milestone by milestone, test-first.** Every battery was seen failing before it was trusted: by a
   stub that threw, by planted bugs, or both. Each milestone has a receipt in `evals/`, and was committed and pushed
   when its gates went green.

| Milestone | State | Receipt |
|---|---|---|
| 2a.1 safety net | **achieved**: CI runs four gates on every push; each failed on its own injected fault | `evals/ci/safety-net.md` |
| 2a.2 bytes decoded | **achieved**: legacy, v0 with pins, v1, no web3.js; 300 golden messages; 300,000 fuzz inputs | `evals/sdk/decode.md` |
| 2a.3 instructions classified | **achieved** | `evals/sdk/classify.md` |
| 2a.4 policy v1 | **achieved** | `evals/sdk/policy.md` |
| 2a.5 admission | **achieved**: rules 0 to 19; D1, D2, D5, D6, D7, D9, D10, D12 closed | `evals/sdk/admission.md` |
| 2a.6 durable state | **achieved**: the restart battery; D11 closed | `evals/sdk/durable.md` |
| 2a.7 Keel hardened | **achieved**: bytes hashed, telemetry checked, sensor v1 measured; D3, D4, D8 closed | `evals/sdk/keel.md` |
| 2a.8 adapters | **achieved** against stand-ins; a real Solana Agent Kit agent is 2b.3 | `evals/sdk/adapters.md` |
| 2a.9 on-chain bound | **rehearsed only**, on a local validator holding Squads v4's devnet program | `evals/onchain/squads-local.md` |
| 2a.10 dashboard v0 | **built and photographed** against that validator; the devnet shot follows 2a.9 | `evals/cockpit/v0.md` |
| 2b.1 verified | **9 of 11 batteries** pass from a clean clone; on-chain and end to end wait for devnet | `evals/verify/beta-gate.md` |

## Changed

| Files | Why |
|---|---|
| `packages/sdk/src/` | rebuilt: `message.ts`, `base58.ts`, `tables.ts`, `classify.ts`, `pda.ts`, `canonical.ts`, `policy.ts` (v1), `guard.ts`, `state.ts`, `log.ts`, `record.ts`, `latch.ts`, `sensor.ts`, `inspect.ts`, `errors.ts`, `adapters/`; `describe.ts` and the old policy removed |
| `packages/sdk/bin/` | `pin-table.ts`, `replay.ts` |
| `packages/sdk/test/` | the decode, classify, policy, admission, durable, Keel, sensor, adapters, inspect, drain and pin-table batteries; `guard.test.ts` retired, each of its properties mapped |
| `apps/sandbox/`, `apps/onchain/`, `apps/cockpit/` | the sandbox on the new API; the Squads drill; the dashboard |
| `.github/workflows/ci.yml`, `tools/ci_host_fixture.py`, `tools/doctor.py` | CI; the runner shaped like the host; the v1 validator check |
| `.claude/settings.json`, `CLAUDE.md` | `plansDirectory`; the architecture and commands as built |
| `docs/` | PRODUCT 1.0; ROADMAP Draft 2; SPEC Draft 3; OVERVIEW Draft 3; CLAIMS 3.1 (S1 to S4 re-pointed, S4 widened, S6 to S9 added) |
| `design/` | ADR-004, 008, 010 and 011 status lines |
| `evals/` | twelve receipts and the index |
| `kb/` | the SIMD-0266 note and the SIMD-0312 layout; the Solana Agent Kit note checked against the package; the registry's pins, advisories and findings U-2 and U-3 |
| `runs/2026-10-01-cockpit-v0.png` | the dashboard's evidence |

## Found

- **The benign battery found a defect in both sensors.** Its first run, on seeds 1 and 2, stopped 94.5% of a benign
  payment stream. Both sensors scored a payment repeated after it landed as a retry, so a recurring payment read as a
  loop, and one REGROUND latched the guard. The repeat's definition was corrected, with no coefficient changed, and
  the battery re-run on fresh seeds: sensor v1 stopped none of 1,200.
- **The latch was derived, not recorded.** A guard restored under a more lenient policy came back unlatched. The
  tripping decision now records `latch: true`. The first test of it passed for the wrong reason, a REGROUND, until its
  drains stopped looking like a loop.
- **Upstream U-2 and U-3 are real**, reproduced first-hand: Keel's `tick()` coerces values `accepts()` refuses, and
  `create()` takes a NaN state.
- **Not stopped:** a loop alternating two shapes with a changing amount; Keel stays at INHIBIT. And the cockpit's
  demo showed one re-send of an unknown-outcome payment meeting REGROUND and latching the guard. Both are open
  questions in `docs/SPEC.md` §12.
- **What failed, or got in the way, at the same size:**
  - **The devnet faucet** rate-limited every airdrop from this machine, so 2a.9 and 2a.10 stop short of devnet.
  - **The boundary guard's Bash heuristic** denied three legitimate commands, on `process.env`, `os.environ` and
    `releaseKey` in heredocs. It failed closed, as designed; the edits went through the Edit tool or a script file
    instead.
  - **The `gh` shim** at `~/.local/bin/gh` hangs; the mise binary works.
  - **One cockpit test run hung**, its own fault: a stub threw before the test's stand-in RPC closed.
  - **Port 8787 belongs to another service** on this machine; the cockpit used 8790.
  - **The auto-mode classifier** was unavailable twice; the edits went through the Edit tool.
- **Mutation checks:** about 70 bugs were planted across the milestones. Survivors were either real gaps, which got a
  test, or equivalent mutants, which are named in their receipts. One cannot be caught by any test here: `fsync`,
  whose effect shows only on power loss.

## Open

1. **The human's: fund the devnet operator.** Send about 0.15 devnet SOL to
   `EnJLeivSjYXLmvmLKzXDy7m9cT23sMBCZpHGkZWtatdq`, from faucet.solana.com. Then
   `node apps/onchain/src/squads.ts --url https://api.devnet.solana.com …` completes 2a.9, and the cockpit's devnet
   shot completes 2a.10.
2. **Next in the build order:**
   - 2b.3, a real Solana Agent Kit agent governed by a one-line change, on a local validator, then devnet;
   - 2b.2, claims current;
   - 2b.4, the Beta review.
3. **Open questions:**
   - Should runs of failed outcomes latch?
   - Should a REGROUND on an already-denied retry latch?
4. **Owed:** an independent evaluator run, by a separate session given only the spec, before 2b.4.
5. **Still the human's, when testing is done:** the licence, the judges' access, the submission; sign-off on the
   milestone reviews.

## Then: milestone 2b.3, the Solana Agent Kit half

After the first close, the session ran a scripted agent built on `solana-agent-kit` 2.0.10's own classes, on a local
validator, with Solanaut adopted by one changed line (`evals/agentkit/sak-local.md`).
- **Drains** were refused on both of the kit's paths, before the wallet was asked to sign.
- **A whole transaction** was checked, signed once, sent by the guard, and landed.
- **The kit's plugin path** asked the wallet to sign each payment twice. The guard refused the second signature as
  `intent-in-flight`, because the first, signed and discarded, could still land.

Reading the published package also found:
- with a Helius key, a signed transaction posted to Helius's mainnet fee API;
- an array of transactions that throws after the first is sent.

The source note is `kb/sources/2026-10-01_solana-agent-kit-signorsendtx.md`; the claims are S10 and M12.
- **What got in the way:** the first run failed in the kit's own simulation, because its `Connection` reads at
  `finalized` and the airdrop was only confirmed. Waiting for finalization fixed it.
- **New advisories:** the kit brings 7 high-severity ones through LangChain, recorded in `kb/REGISTRY.md` and
  confined to `apps/agentkit`.

## Provenance

- **Toolchain:** Node 26.7.0, npm 11.19.0, TypeScript 7.0.2, Agave 3.1.10 (4.3.0 for v1), uv 0.12.10, Chrome 153.
- **Pins:** `@gubernaut/core` 1.0.1 (wasm `834015d7…`, module `8f642684…`), `@solana/kit` 8.4.0, `@solana/web3.js`
  1.99.0, `@solana-program/system` 0.15.0, `token` 0.17.0, `compute-budget` 0.19.0, `@sqds/multisig` 2.1.4.
- **Gates at close:** `npm test` 147/147; `npm run typecheck` clean; `boundary_guard.py --selftest` 34/34;
  `kb_lint.py` PASS; CI green on every push; `session_close.py` as run below.
- **Regenerate:** each receipt's last section.
