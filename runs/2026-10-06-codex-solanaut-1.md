# 2026-10-06 — codex-solanaut-1

## Asked

Resume the approved Solanaut 1.0 implementation. Continue through unblocked work, retaining
all security, validation and human-owned release gates.

## Did

- Continued from `b7d24a5`, privately pushed; CI `37405479424` passes all approved runtimes.
- Read the project law, handoff and progress. Fetch completed; working tree contains only the
  next proposal-refusal tests. Both live boundary probes refused correctly; no probe created.
- Initial LIF-5/transport battery from the preceding date: 27 cases, four failures, 23 passes.
  Pre-admission refusal history and message-size alignment fail as intended; the already-recorded
  admission error case passes. Scratch evidence: `.sandbox/solanaut-1/refusal-red.log`.

## Changed

- Handler and SDK journal store pre-admission refusal payloads/answers; interrupted refusal
  starts complete without new proposal work. Errors after admission stay with signing history.
- Transport aligns its message bound with the core. Tests/maintained faults, receipt/index,
  claims/SPEC/trust docs/progress and register now describe the partial implementation.
- Reversible codec decision inside ADR-019: refusal payload is exact message/group, with
  fixed deadline/unavailable codes; no new socket method. Existing binary readers may refuse
  this history and must pass compatibility checks before rollback.

## Found

- Proposal failures before admission leave no durable request answer. An interrupted refusal
  also needs conservative recovery without calling the proposal executor again.
- Transport currently accepts a message larger than the core's bound. Such input must be
  rejected as a protocol frame before dispatch.
- Both findings corrected: 28 focused cases pass; nine handler, nine socket and eight control
  faults caught. No miss in these final runs. Strengthened incomplete-frame fixture before
  mutation because the new message bound would mask removal of the framing bound. A fixture
  proposal signature failed typecheck, corrected to the real argument type. No gate widened.

## Open

- Operational signer lifecycle, protected key/configuration, signed-policy enforcement,
  disk request index/snapshots and full security/reliability qualification remain owed.
- Same human dependencies as `docs/HANDOFF.md` §5; no Alpha or stable-release claim.
- Existing protected-file owed edit O1 remains in HANDOFF §6; no protected file changed.

## Provenance

Starting HEAD `b7d24a5`; Node 26.7.0, Keel 1.0.1 and sensor v1. Commands:
`node --test apps/signer/test/handler.test.ts apps/signer/test/socket.test.ts`,
`npm test`, `npm run typecheck`, `uv run --script tools/session_close.py --slug codex-solanaut-1`.
Builder-authored evidence; no key-file read, real chain send, OS-user creation or publication.
Final commands/retained outputs: `evals/signer/refusal.md`. Full suite 295 passes, typecheck
clean and four installed package checks pass. Partial signer/helper total 453 lines against
the unchanged 500-line final budget; host service and full qualification remain owed.
