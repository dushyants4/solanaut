# Keel hardened, and sensor v1: shown failing, then measured

Milestone 2a.7 in [docs/ROADMAP.md](../../docs/ROADMAP.md): the controller's bytes hashed (D4); telemetry checked before
each tick (D3); sensor v1 (D8); upstream findings U-2 and U-3 reproduced or refuted ([docs/SPEC.md](../../docs/SPEC.md)
§6). D12 had already closed at 2a.5. Run on 2026-10-01 with Node 26.7.0 and `@gubernaut/core` 1.0.1.

| File | What it is |
|---|---|
| `packages/sdk/src/guard.ts` | `verifyKeelSource`, run on the module Node actually loads, at every `createGuard` and `replay`; telemetry checked before `tick()` |
| `packages/sdk/src/sensor.ts` | `sensorV1` and its stated coefficients, `SENSOR_V1`; sensor v0 kept for comparison |
| `packages/sdk/src/state.ts` | the sensors' memory: unknown outcomes, fees, the last minute's times, and which recent intents landed |
| `packages/sdk/test/keel.test.ts` | 12 tests |
| `packages/sdk/test/sensor.battery.test.ts` | the benign and loop batteries, v0 against v1 |

## 1. Failing first

The battery ran against stubs of `verifyKeelSource`, `VERIFIED_KEEL_MODULE` and `sensorV1`:

```
ℹ tests 10   ℹ pass 2   ℹ fail 8
```

The two passes are the upstream reproductions, which test Keel itself, not Solanaut's code.

## 2. Upstream findings: both reproduced first-hand

```
  U-2: tick() on telemetry accepts() refuses: null → DEFAULT; "0.5" → DEFAULT; true → DEFAULT; [0.7] → DEFAULT
  U-3: Governor.create({ equilibrium: NaN, arousal: 5 }) → created; the next tick gives INHIBIT with equilibrium 0.30000000000000004
```

- **U-2 is real.** `tick()` coerces values `accepts()` refuses. **Solanaut's side (D3):** telemetry must be three
  numbers that `accepts()` takes before Keel sees it. Anything else denies as `fail-closed`, and Keel does not tick.
- **U-3 is real.** `create()` takes a non-finite, out-of-range state and carries it forward. **Solanaut's side:** a
  guard's Keel is only ever created fresh and rebuilt by replaying its own record (ADR-010). No state is ever passed
  in.

## 3. D4: the bytes

`verifyKeelSource` hashes two things in the module Node resolves for `@gubernaut/core`:
- **the embedded wasm,** against Keel's declared digest `834015d7…ded7d8`;
- **the whole module,** `dist/index.js`, which is the code that runs the wasm, against
  `8f642684bf1dccbdaed1e35e0092e11d0cfc309c0491b1c79f6472616b9c7190`.

A guard that fails either check does not exist. One changed byte in the wasm is refused, and so is one changed byte
in the JavaScript around an intact wasm. Every decision now records `keel.verified: "bytes"`.

**The limit, stated.** The module is hashed when the guard is created. The code that runs is whatever Node loaded at
import, so a file swapped between import and creation would not be caught.

## 4. Sensor v1, and the battery that changed it

Sensor v1's coefficients were fixed before the battery first ran: the rate over the trailing minute against the
policy's expected rate, 0 at or below it and 1 at five times it; valence 0.2, less 0.3 per denial, failure, expiry or
unknown outcome; repetition 1 for the same payment, 0.8 for fee escalation, 0.5 for the same shape.

**The first run, on seeds 1 and 2, found a defect in both sensors.** It was the same for v0 and v1:

```
benign: Poisson, 6 a minute · sensor v0: 567 of 600 stopped, 94.50% (95% CI 92.38% to 96.06%) {"loop-reground":1,"latched":566}
benign: Poisson, 6 a minute · sensor v1: 567 of 600 stopped, 94.50% (95% CI 92.38% to 96.06%) {"loop-reground":1,"latched":566}
benign: bursts of 5        · sensor v0: 206 of 600 stopped, 34.33% (95% CI 30.64% to 38.22%) {"loop-reground":1,"latched":205}
benign: bursts of 5        · sensor v1: 206 of 600 stopped, 34.33% (95% CI 30.64% to 38.22%) {"loop-reground":1,"latched":205}
```

- **The cause.** A trace found it. At payment 33, the stream paid destination 1 the same amount it had paid at
  payment 25, which had landed. Both sensors score any repeat of a recent intent as repetition 1, so Keel returned
  REGROUND at once. One REGROUND latches the guard, and with no operator in the battery, every later payment was
  denied.
- **Why it matters beyond the battery.** Recurring payments of one amount to one address, such as payroll or a
  subscription, would trip it every cycle.
- **The change, in definition, not in any coefficient.** A recent intent that has **landed** no longer counts as a
  retry, only as the same shape. A loop is an action re-proposed before it lands.
- **What it costs.** A runaway loop of payments that all land now reads as the same shape. Keel will not stop it; the
  window caps bound it. That trade is recorded in [docs/SPEC.md](../../docs/SPEC.md) §6.

**The second run, on fresh seeds 3 and 4, after the change:**

```
benign: Poisson, 6 a minute (the policy's expected rate) · sensor v0: 497 of 600 stopped, 82.83% (95% CI 79.61% to 85.64%) {"loop-reground":1,"latched":496}
benign: Poisson, 6 a minute (the policy's expected rate) · sensor v1:   0 of 600 stopped,  0.00% (95% CI  0.00% to  0.64%) {}
benign: bursts of 5 payouts, 0.2 to 0.6 s apart, every 5 minutes · sensor v0: 130 of 600 stopped, 21.67% (95% CI 18.56% to 25.14%) {"loop-reground":1,"latched":129}
benign: bursts of 5 payouts, 0.2 to 0.6 s apart, every 5 minutes · sensor v1:   0 of 600 stopped,  0.00% (95% CI  0.00% to  0.64%) {}
```

**The loop battery,** the same on both runs:

| Loop, the send failing each time | Sensor v0 | Sensor v1 |
|---|---|---|
| identical retries, 400 ms apart | turn 3, `loop-reground` | turn 3, `loop-reground` |
| identical retries, 5 s apart | turn 3, `loop-reground` | turn 3, `loop-reground` |
| fees rising each retry, 400 ms apart | turn 3, `loop-reground` | turn 4, `intent-attempts-exhausted`; Keel says REGROUND at that turn too |
| two shapes alternating, the amount changing, 400 ms apart | **not stopped in 12 turns** | **not stopped in 12 turns** |

- **Fee escalation is caught a turn later** by v1 than by v0. v1 scores it 0.8, as the spec defines it; v0 scored
  every same-intent re-proposal 1. The attempts cap stops it first, at turn 4.
- **A loop that alternates two shapes and changes its amount is not stopped.** Each proposal is a new intent, so the
  attempts cap never fills, and Keel stays at INHIBIT. The failed sends move no value, but they spend fees. The fee
  window, and the 30% clamp under INHIBIT, are its bounds. Whether a run of failed outcomes should trip the latch is
  an open question in [docs/SPEC.md](../../docs/SPEC.md) §12, for the Alpha's red team.

**The battery asserts no threshold.** Its one assertion about D8 is that sensor v1 stops no more benign payments than
sensor v0 on the same streams.

## 5. Five planted bugs: four caught at first, all five after one more test

| Planted bug | Failing tests |
|---|---|
| the guard never verifies the loaded controller | 1 |
| only the wasm is hashed, not the module that runs it | 1 |
| telemetry reaches Keel unchecked (D3) | 1 |
| the rate term counts from zero, not from the expected rate (D8) | 1 |
| the state never marks a landed intent | **0**, then 1 |

**The fifth survived at first.** The unit test gave the sensor a view already marked "landed", and the fresh streams
held no identical repeat. A test through the guard now pays, lands, and pays the same again, and requires the
repetition of 0.5.

```
npm test: ℹ tests 123   ℹ pass 123   ℹ fail 0
```

## Regenerate

- `node --test packages/sdk/test/keel.test.ts packages/sdk/test/sensor.battery.test.ts`
