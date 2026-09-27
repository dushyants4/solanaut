---
type: source
status: current
url: "https://registry.npmjs.org/@gubernaut/core"
title: "@gubernaut/core 1.0.1 — npm registry record and the installed package"
publisher: "npm; Gubernaut"
published: "2026-08-07"
fetched: 2026-09-27
checked: first-hand
created: 2026-09-27
updated: 2026-09-27
---

# @gubernaut/core 1.0.1 (Gubernaut Keel)

The controller Solanaut depends on. Read two ways: the npm registry record, and the installed package
itself (`node_modules/@gubernaut/core`: `README.md`, `dist/index.js`, `dist/index.d.ts`).

## Key facts

- **One version exists:** 1.0.1, published 2026-08-07T18:45Z. `"versions": ['1.0.1']`, from the
  registry JSON.
- **API** (`dist/index.d.ts`, README):
  - `Governor.create(initial?)` is async "only because `WebAssembly.instantiate` is", and every
    `tick()` after it is synchronous.
  - `tick(t)` returns `{posture, temperatureMax, equilibrium, arousal, perseveration, recovery}`.
  - `Governor.accepts(t)` checks a reading without ticking; `state` returns a copy; `reset()`
    returns to the initial state.
- **Postures** (README table):
  - DEFAULT: "benign traffic. Nothing to do."
  - INHIBIT: "an escalating spiral".
  - REGROUND: "a saturating loop. Break it."
  - `temperatureMax` is 1.0 when open and "clamped under INHIBIT and REGROUND".
- **Telemetry:** intensity in [0,1], valence in [-1,1], repetition in [0,1]. Out-of-range and
  non-finite numbers throw `GubernautBoundaryError`, "rejected rather than clamped". A rejected tick
  does not advance state.
- **The digest is a constant.** `dist/index.js` line 93 reads `var wasmDigest = WASM_SHA256;`, and
  nothing in `dist/` computes a hash. Loading checks only the decoded length of `WASM_BASE64`
  against `WASM_BYTE_LENGTH` (17,082). The README says the digest "is verified at build time by the
  embed script… and again on load" (lines 89–90).
- **Size and integrity:** `dist/index.js` has SHA-256 `8f642684…9c7190`. The lockfile's npm integrity
  value is `sha512-SOm7kfRl…qBSlTA==`.

## What it supports

- `docs/CLAIMS.md` S4, corrected: Solanaut's startup check compares two constants until H1 hashes
  the bytes. This is also an upstream finding in `kb/REGISTRY.md`.
- [kb/wiki/gubernaut/_index.md](../wiki/gubernaut/_index.md)

## Caveats

- A research agent also found, by running the package, that `tick()` accepts `null`, `"0.5"`, `true`
  and `[0.7]` (JavaScript coerces them to numbers) while `accepts()` rejects them, and that
  `Governor.create(state)` accepts NaN state. **Not yet reproduced here**: H1's first evals
  reproduce both before any claim rests on them.
