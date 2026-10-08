# SNP-5/6, LIF-2/7 — receipt recovery validation (D23)

2026-10-08 · builder peer/evaluator-authored regression and builder repair ·
Linux/x86-64, Node 26.7.0 · base 5b00257 plus candidate. Not Claude RT-2.

Read-only in-memory probes and the first sixteen-case battery establish recovery
acceptance of absent/denied, duplicate, post-final, expired, missing-height,
malformed and prior-policy redemption. Four positive compatibility cases pass;
twelve rejection/atomic cases fail. No key file, funded transaction or external
provider is involved.

Shared application now validates redemption before advancing any state: a real
allowed reservation and unresolved matching attempt, unused receipt, finite
nonnegative time, canonical recorded bigint height and inclusive expiry. Signed
chronological policy context is passed by replay/restore, inspection and state
preparation. The comparison is conditional because unsigned SDK records do not
record historical policy selection. Legitimate unsigned redeemed history reopened
under another advisory policy still works. Canonical negative bigint heights are
also retained because live SDK redemption accepts them today; this is compatibility,
not authoritative chain evidence. No state field or snapshot format changes.

All sixteen final cases pass. They exercise array/stream replay, restore-store
closure, inspection, direct-state atomic refusal, pruned final reservations and
signed state preparation. Nineteen source faults catch with exact restoration of
state/guard/inspection files: missing validation, finite/negative time, admission,
single use, finality, signed context/equality, unsigned compatibility, canonical
height, expiry/boundary/missing-height, negative/no-expiry compatibility, ordering
and both used-receipt markers. No missing module, syntax error, signal or timeout
is credited. Live commit's duplicate context and checkpoint state's context are
defence in depth under their existing prechecks/full replay; their omission is
not separately claimed as a caught trial.

The original typecheck finds readonly cloned fixture arrays; explicit array copies
correct their types without changing assertions. Integrated and installed evidence
is in `request-index-integration.md`, including direct compiled replay/restore
rejections and boundary/single-use/lifetime faults. Original failures remain.

Regenerate: `node --test packages/sdk/test/redeem-replay.test.ts`;
`node evals/sdk/redeem-replay-faults.ts`; `npm run release:prepare`;
`node --test evals/packaging/packed-sdk.test.ts`; `node evals/packaging/faults.ts`.
Raw source evidence and hashes: `redeem-replay/`; shared integrated evidence:
`request-index-integration/`.

This rejects impossible transitions; a resealed chain alone still supplies no
external authenticity. No unconditional unsigned-policy migration, stricter live
negative-height rule, signer expansion or new public API is introduced. Independent
security, complete recovery, full mutation and release qualification remain owed.
