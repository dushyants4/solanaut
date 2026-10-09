# Private operator release — queued latch lifecycle

2026-10-09 Toronto · Linux/Node 26.7.0 · base `46922d5` plus candidate.
Builder-authored offline component evidence, not independent review.
Requirements SNP-5/7, OPR-2 and STO-1; accepted ADR-019 and existing latch rules.

## Contract

The private facade queues `releaseText` and `release` with admission, redemption,
control work, observations and shutdown. Preparation accepts a primitive expiry
string and returns only the current structured release text with canonical shape
and a finite parsed expiry. It does not sign. An expired but otherwise valid text
may be prepared; release still checks expiry against the latest recorded time.

Capture signature bytes into private ordinary backing before queueing. Delegate
the existing operator-signature/guard/cluster/policy/latch-sequence/expiry checks.
Only synced success returns a detached frozen result. Every refusal throws fixed
`OwnedGuardError`, including failed append diagnostics. Release resets the latch
and Keel through the existing journal; it does not discard pending reservations,
used receipts or history. Failed writes preserve the latch on restart.

This is generic SDK operator bookkeeping, with trusted caller time. No executable
signer, authority change, policy installation, key loading, signing/send, agent
socket method or stable root export is added. Full retained state and operational
ceremonies remain owed; no SIG-11 compliance or bounded recovery is claimed.

## Initial failures and maintained trials

The new source cases first fail on absent methods and exact surface. The installed
previous JavaScript fails on absent release-text preparation. The first positive
fixture mistakenly compares explanatory `reason` with a rule ID; retain its output
and correct the assertion to `rule`, preserving exact reservation-denial checks.

The first release-text FIFO trial bypasses both queueing and error mapping. Its
raw guard error fails the campaign's existing strict diagnostic check. Preserve
that failure and revise only the trial to retain error mapping while bypassing
the queue. The checker and its exclusions remain unchanged. Other trials cover
early release dispatch, signature capture, refusal/storage success substitution,
mutable replies, prompt shape, parsed expiry and primitive argument validation.
Every prior source/compiled trial remains.
The initial compiled FIFO trial also has an emitted-layout mismatch; the
unchanged-candidate assertion rejects it after the earlier trials. Preserve that
campaign and correct only the matcher to the actual multiline method. Full
retained compiled qualification completes with the restored consumer passing.
Separate archive and source/input/emitted-file identities are bound before full
measurement; previous component archives remain unchanged.

The source cases include preparation behind queued latching decisions, held prior
control work, shared signature mutation, frozen success and status ordering,
expired/wrong-scope/malformed signatures, invalid prompt shapes/dates/objects,
post-close refusal and actual write-error injection. Pending spending survives
successful release; latch state survives failed release and restart.

Definition 37/seed 37417 is declared before candidate full measurement. It adds
the operator cases and retains every previous input, floor, wait and limit.

```bash
node --test --test-isolation=none packages/sdk/test/owned-guard.test.ts
node evals/sdk/owned-guard-faults.ts
npm run typecheck
npm run release:prepare
node --test evals/packaging/packed-sdk.test.ts
node evals/packaging/faults.ts
npm test
npm run test:coverage -- --serial
uv run --script tools/session_close.py --slug codex-solanaut-1
```

## Status

Raw outputs live in `evals/sdk/owned-release/`. Sixteen focused cases, all
thirty-three retained source faults, twelve installed cases and all 127 retained
compiled faults pass with exact restoration. Native and serial AST each pass
all 841 cases; typecheck exits zero and unchanged AST floors pass. The private
facade covers 109/112 statements and 46/48 branches. The definition, archive,
sources, evaluation inputs and emitted files are bound in `installed-candidate.json`;
post-restoration identity verification passes. CLAIMS S98 records these scoped
builder-authored measurements. This is no independent security evidence or full
mutation score. H9/H11 are not accepted by a continuation request; human, Claude, audit
and publication gates remain. Local commits/backups only, with no remote push.

Pre-commit close passes eight of ten gates, failing dirty tree and unpushed HEAD
only. The latter remains required by the user's local-only direction; preserve
the gate unchanged. Authored TypeScript/Markdown diff checks pass.
