# The Beta gate: every §11 battery, from a clean clone

Milestone 2b.1 in [docs/ROADMAP.md](../../docs/ROADMAP.md): every Beta battery in [docs/SPEC.md](../../docs/SPEC.md) §11
passes from a clean clone, run by the evaluator seat, and each new gate was seen failing on an injected fault.

**Eleven of eleven batteries pass.**
- **Nine** pass from a clean clone.
- **The on-chain and end-to-end batteries** passed on devnet on 2026-10-01, once the human funded the operator key:
  [onchain/squads-devnet.md](../onchain/squads-devnet.md) and [e2e/scenes-devnet.md](../e2e/scenes-devnet.md).

**What remains for 2b.1's gate is procedural.** The batteries were run by this session, playing the evaluator seat. An
independent run, by a separate session given only the spec, is owed before milestone 2b.4.

## The clean clone, 2026-10-01

Run twice. The second run was after the devnet runs, at `5fa5f91`: `npm ci` added 351 packages, and `npm test` passed
149 of 149 in 4.7 s, with typecheck clean and `kb_lint` passing. D14 added three tests after that: 152 of 152, on this
disk and in CI. The first run:

```
git clone https://github.com/dushyants4/solanaut.git    # at 0c982ff
npm ci                                                   # added 202 packages
npm test                                                 # 4.7 s
ℹ tests 147   ℹ pass 147   ℹ fail 0
npm run typecheck                                        # clean
uv run --script tools/kb_lint.py                         # PASS
```

Every measurement in the clone matched this disk's, number for number: they are seeded and deterministic.

## The batteries

| §11 battery | Passes when | Evidence | Result |
|---|---|---|---|
| fail-closed | every case denies with its named rule | `decode.test.ts` (garbage, unknown versions, unpinned tables, indexes past a pin), `keel.test.ts` (non-number telemetry, a tampered controller), `policy.test.ts` (an invalid policy) | **passes** |
| drain, at least 30 incident-shaped cases | every case denies with its named rule | `drain.battery.test.ts`: 40 shapes across T1, T2, T3, T5, T8, T14, T15, T19, T22, T23, T26, T27 | **passes: 40 of 40 denied**; 3 planted guard faults caught |
| double-send | in flight; allowed; in flight; in flight | `admission.test.ts`, rules 14 and 15 | **passes**, with the boundary at exactly the last valid height |
| concurrency | exactly the cap admitted | `admission.test.ts`: 50 proposals in one tick, 9 admitted against 1 SOL | **passes** |
| restart | the restored state equals the state before, checked by replay | `durable.test.ts`: 20 SIGKILLs; the record ends identical, hash for hash, to an uninterrupted run, and replays | **passes** ([sdk/durable.md](../sdk/durable.md)) |
| latch | released; refused; refused; refused | `admission.test.ts`, the latch battery, and `durable.test.ts`: the latch survives a restore under a lenient policy | **passes** |
| loop | the stop turn measured and reported | `sensor.battery.test.ts` | **measured**: identical retries turn 3; rising fees turn 4; two alternating shapes not stopped in 12 turns ([sdk/keel.md](../sdk/keel.md)) |
| benign, at least 500 payments | the false-stop rate measured, with a 95% interval | `sensor.battery.test.ts` | **measured**: sensor v1 stopped 0 of 600 at the expected rate and 0 of 600 in bursts (upper bound 0.64% each) |
| adapters | the same verdicts as the SDK, a one-line change each | `adapters.test.ts`: six cases, legacy and v0, through `guardedWallet` and a bare guard; the kit signer with kit's own `KeyPairSigner`. Then a real Solana Agent Kit agent, on a local validator and on devnet | **passes** ([agentkit/sak-devnet.md](../agentkit/sak-devnet.md)); the kit's plugins' path is refused at its second signature, as specified |
| on-chain | the program refuses past the limit, on devnet | `apps/onchain/src/squads.ts` | **passes on devnet**: `SpendingLimitExceeded`, `InvalidDestination`, and `AccountNotInitialized` after a revoke landed 3 slots after its send ([onchain/squads-devnet.md](../onchain/squads-devnet.md)) |
| end to end | the incident-shaped scenarios on devnet, shown in the dashboard | `apps/onchain/src/scenes.ts`, the drill and the cockpit | **passes on devnet**: DEMO.md's scenes through `guardedWallet`, a real SIGKILL and restore, each refusal in the dashboard with its rule ([e2e/scenes-devnet.md](../e2e/scenes-devnet.md)) |

## Each new gate, seen failing first

Every battery above was seen failing before it was trusted, by a stub, a planted bug, or both. The receipts give the
details: [sdk/decode.md](../sdk/decode.md), [sdk/classify.md](../sdk/classify.md), [sdk/policy.md](../sdk/policy.md),
[sdk/admission.md](../sdk/admission.md), [sdk/durable.md](../sdk/durable.md), [sdk/keel.md](../sdk/keel.md),
[sdk/adapters.md](../sdk/adapters.md), [cockpit/v0.md](../cockpit/v0.md). The drain battery ran over code that
already existed, so it was shown failing on three planted guard faults instead: rule 9 off, token destinations
unchecked, an index past a pin let through. Each fault let at least one drain through.

## The seat

The evaluator's question is "does it actually pass, on a case that could fail?" These runs answer it for the code as
built. This session played every seat in turn, so the evaluator's independence is procedural: each battery ran
against stubs and planted faults, not only against the code it tests. An independent evaluator run, by a separate
session given only the spec, is owed before milestone 2b.4's review.

## Regenerate

- `git clone`, `npm ci`, `npm test`, `npm run typecheck`, `uv run --script tools/kb_lint.py`
