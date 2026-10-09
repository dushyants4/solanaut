# Unrecorded private admission replies — D32 correction

2026-10-09 Toronto · Linux/Node 26.7.0 · base `c891c8c` plus candidate.
Builder-authored partial evidence under accepted ADR-019; not independent review.
SPEC OPR-2, STO-1, LIF-1 and SNP-7. No signer expansion or threshold change.

## Finding and frozen correction

The private facade delegates to the trusted SDK companion, which deliberately
returns an unrecorded denial sentinel on append failure or identity collision.
That sentinel has negative sequence and may contain the raw storage exception.
Returning it from the facade contradicts its fixed-error contract and does not
provide durable admission evidence. Preserve the trusted synchronous SDK and
companion contract; the facade instead throws fixed typed `OwnedGuardError` for
any negative-sequence result. Durable allowed/denied decisions and same-payload
retries remain unchanged. The failed writer is not reopened; no reservation is
released, transaction signed or request resent.

## Initial evidence

The expanded source population first executes ten cases: eight pass and the
collision/storage cases fail on missing expected rejection. The storage case
uses the actual owned history and journal, replacing only the actual descriptor
write with a sentinel failure. Sequence remains unchanged; later admission still
refuses. All nineteen source trials catch/restored, retaining the prior seventeen
and adding separate storage/collision regressions.

The installed regression fails on the actual previous private package: changed
payload returns an unrecorded decision instead of the fixed error. Candidate
compilation and maintained compiled faults follow. Definition 35/seed 35447 is
declared before full measurement; selected population adds the storage case,
retaining every earlier test/source, wait, limit and floor. H11 is still pending.

Packing the new private candidate reuses the earlier ignored tarball path and
causes a detectable digest mismatch. Preserve the new archive separately;
rebuild the prior candidate from the exact `36a1ae7` local bundle restore with
the pinned compiler. The rebuilt archive matches the earlier SHA-256 byte for
byte. Its first reconstruction attempt lacks a scratch directory and fails
before building; fix setup, then reproduce. The build uses the existing pinned
dependency tree, not a clean-machine install. Future candidate archives use
distinct component paths. No evidence identity is silently reassigned.

```bash
node --test --test-isolation=none packages/sdk/test/owned-guard.test.ts
node evals/sdk/owned-guard-faults.ts
npm run release:prepare
npm run test:package
npm run test:package:faults
npm test
npm run typecheck
npm run test:coverage -- --serial
uv run --script tools/session_close.py --slug codex-solanaut-1
```

## Measured candidate outcomes

Ten focused cases and all nineteen semantic source trials pass/restored.
Twelve installed cases and all 119 compiled faults catch/restored; preserve all
118 earlier trials and add the unrecorded-admission fault. Quiet ordinary suite
passes all 835 cases, including the exact selected 529-case baseline, and native
typecheck exits zero. `installed-candidate.json` binds product/evaluation sources
and the private archive at a distinct component path. Previous archive identity
is restored byte for byte; no source identity is reassigned.

Run performance-sensitive qualification without competing campaigns. Serial AST
has already failed the unchanged real-baseline wait in this candidate run; its
complete output follows. No complete coverage/mutation, bounded recovery, signer
isolation or release claim. H9/H11 acceptance remains pending. Local close/commit
results follow; no push is authorised.

Complete serial AST executes 835 cases: 834 pass and the unchanged real-baseline
wait fails. Its completion guard refuses qualification; no passing coverage
summary follows. Retain `coverage.txt` and `coverage-failed-definition35/` in full.
Every bound product/evaluation/archive digest matches after restoration.

Pre-commit close passes eight of ten checks, failing only pushed HEAD and the
staged tree. Secret scan and authored diff checks pass. Local commit and backup
verification follow; the coverage failure remains a qualification finding.

Local implementation commit: `944579d469c9f4712f4e74d6cbfff3a394ba0cdb`.
Its Git bundle verifies; a local clone restores the exact clean revision with
passing full object-integrity verification. Post-commit close passes nine of ten
checks, failing only pushed HEAD under the human's explicit local-only direction.
No push occurs. Source-history backup does not establish operator-state recovery
or off-device protection; AST/driver and stable-release gates remain open.
