# SNP-5 — replay a validated prefix into fresh Keel

2026-10-07 · builder-authored Linux/Node 26.7.0 component evidence · base
0c61fa3 plus candidate. No root SDK export or signer method added.

`rebuildCheckpointPrefix` captures inputs and external policy pins, derives the
expected prefix through full history replay and requires exact canonical byte
agreement. It parses only those derived bytes, creates a fresh published Keel
controller, replays ticks and resets, and checks every recorded posture. It
returns the mutable runtime controller inside an immutable endpoint/event receipt.
No stored controller-state numbers are loaded.

The initial new cases fail for the missing function. Focused cases compare the
next controller decisions against an independently constructed controller fed the
full entry stream, including reset boundaries. Reordered, missing, extra and
malformed events refuse. Captured inputs survive caller mutation during replay.
An injected divergent fresh controller refuses. Signed policy changes require
their external policy trust pins.

Thirteen focused cases and twenty-two source faults pass with restoration.
Source omissions include the canonical comparison, reset, posture comparison,
event count and immutable return; all original preparation faults remain. The
installed previous artefact refuses the new function; compiled candidate and
expanded driver validation follow below. A fresh mutation definition retains the
entire prior scope and uses seed 23837; no floor or wait changes.

Commands: `node --test packages/sdk/test/checkpoint-prefix.test.ts`;
`node evals/sdk/checkpoint-prefix-faults.ts`; `npm run release:prepare`;
`node --test evals/packaging/packed-sdk.test.ts`; `node evals/packaging/faults.ts`;
`node evals/ci/mutation-recovery-faults.ts`; `npm test`; `npm run typecheck`;
`npm run test:coverage -- --serial`. Raw evidence: `checkpoint-rebuild/`.

This component relies on full history validation. It neither authenticates an
envelope by itself nor loads admission state, verifies external anchor evidence,
implements prefix-plus-tail guard recovery or achieves bounded-memory/startup
targets. Trusted unsigned SDK history remains distinct from isolated signed
history. Complete SNP-5/6 and independent qualification remain owed.

Installed validation passes ten cases and thirty-two compiled faults with
restoration. Recovery/driver validation passes fifteen faults and restored real
baseline 321 cases. Definition 12 retains all prior sources/tests, fresh seed
23837 and the unchanged baseline wait, floors and supervisor limit. Its first
expected definition mismatch is retained; no mutation score is measured. Full
ordinary/AST integration follows. Genesis and reset-heavy histories are both
covered in the focused battery.

Ordinary and serial AST integration both pass 615 cases; typecheck exits zero.
All unchanged floors pass. Prefix coverage is 46/47 statements and 42/43
branches. Exact source and AST input hashes are retained. These remain builder
measurements; the preceding publication's hosted runtime/AST failures remain open.
Completed exact logs confirm unchanged-wait failures in the runtime matrix and
AST; the maintained fault job passes. Publication receipt preserves the failures.
