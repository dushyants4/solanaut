---
type: topic
status: current
created: 2026-09-27
updated: 2026-09-27
---

# Gubernaut Keel, as Solanaut uses it

**Sources:**
- [npm and the installed package](../../sources/2026-09-27_npm-gubernaut-core.md)
- [LIMITS.md](../../sources/2026-09-27_gubernaut-limits.md)
- [on-chain receipts](../../sources/2026-09-27_gubernaut-onchain-receipts.md)
- [releases](../../sources/2026-09-27_gubernaut-releases.md)

Keel is Gubernaut's controller, published as `@gubernaut/core`. It reads three bounded numbers per turn
and returns a posture. Solanaut uses it for one job: telling when a stream of transaction proposals has
become a loop. It is a pinned, unmodified, pre-existing dependency, disclosed under Colosseum's rules.

## Key takeaways

- **The API** is `Governor.create()` (async), `tick()` (sync), `accepts()`, `state` and `reset()`. The
  postures are DEFAULT ("benign"), INHIBIT ("an escalating spiral") and REGROUND ("a saturating loop.
  Break it"). `temperatureMax` drops from 1.0 to 0.3 under both INHIBIT and REGROUND.
- **Bad telemetry throws.** Out-of-range and non-finite numbers throw `GubernautBoundaryError`, and a
  rejected tick does not advance state.
- **Only 1.0.1 is published** (npm, 2026-08-07). Gubernaut itself went public on 2026-07-29.
- **The constants are working defaults**, not the held-out configuration Gubernaut evaluated. None of
  Gubernaut's published figures describe what Keel does inside Solanaut.
- **Its limits are published:** it is "not injection-proof", and there is no jailbreak rate "because
  none was measured".
- **Nothing public is on Solana.** Gubernaut's on-chain demonstration used a local EVM devnet, where an
  ElizaOS agent was severed at turn 4 with Tiller's client, not Keel.

## Details: what Solanaut must handle itself

These are the upstream findings, recorded in [kb/REGISTRY.md](../../REGISTRY.md):

1. **The digest is a constant.** `wasmDigest` is set from `WASM_SHA256`, and loading checks only the
   byte length. Solanaut's current startup check compares that constant to its own pin, so it proves
   nothing about the bytes. H1 decodes the embedded wasm and hashes it.
2. **`tick()` may coerce non-numbers** (reported by a research agent, not yet reproduced). Solanaut
   validates telemetry with `Governor.accepts()` and its own type checks before ticking.
3. **Restored state is not validated** (same caveat). Solanaut never restores a state it did not write
   and verify.
4. **The npm description overstates.** It says the package "hard-stops runaway loops", while its README
   says it "does not intercept". The unpublished 1.0.2 fixes the wording.

## For Solanaut

- **Keel only restricts.** A DEFAULT posture never allows anything the policy would deny; posture is
  never authorisation. See [the admission pattern](../security/admission-pattern.md).
- **The observed stop turn is consistent with the API.** With `repetition = 1` on every tick, REGROUND
  arrives on the second such tick. The sandbox's stop at turn 3 is the second repeat.

## Related

- [Solana transactions for a firewall](../solana/_index.md)
- `docs/CLAIMS.md` §2

## Open questions

- Does Keel's wasm implement the same equations as the Python reference at the same constants? Its
  README says it is bit-exact on 73 steps, but Solanaut has not re-run that corpus.
