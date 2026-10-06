# Same-user host composition — SIG-1/2/8/10, POL-2

Measured 2026-10-06, Node 26.7.0, Keel 1.0.1/sensor v1. Revision: commit containing
this receipt (`git log -- evals/signer/service.md`). Builder-authored, local Linux sockets
and records, fake RPC and memory-only crypto keys. No actual key-file loading or isolated user.

Five cases fail against the stub (`service/red.txt`). The initial implementation passes
them. Added shutdown cases expose an untracked host recovery: close released ownership while
it still read chain evidence (`service/drain-red.txt`, six pass/one fails). Tracking both
socket work and host recovery corrects it. Seven final cases pass (`service/green.txt`).
The expanded core/policy/journal/service battery passes 41 cases (`service/focused.txt`).

Composition validates signed authorization before ownership, requires owned real mode-0700
history parent and mode-0600 regular single-link record, takes kernel ownership with creation
disabled, restores signer attribution/clock and recovers before listening. Explicit same-user
mode reports no key isolation. Status includes policy hash/version, guard status and incomplete
recovery, with no key or raw provider error. Closing stops dispatch, closes sockets, drains
host work and only then releases the record. Close is idempotent; recovery after close refuses.

`node evals/signer/service-faults.ts` catches eight final faults: unsigned bootstrap,
permissions bypass, false isolation, hidden recovery failure, early lock release, omitted
drain, omitted host recovery tracking and recovery after stop. Source is restored and checked.
Initial removal of the duplicate authorization check was a surviving mutation because the
SDK still checked it; retained in `service/service-faults-initial.txt`. The stronger whole
unsigned-bootstrap fault and permission fault exposed fixture cleanup omissions: unexpected
successful services kept the child alive. Fixed cleanup, preserving refusal assertions.
Both failures and a later ambiguous selector are retained. None is reported as a caught
valid fault. Final output: `service/service-faults.txt`.

Core/journal simplifications remove repeated type checks and duplicate allow verification;
existing six core and seven signing faults still pass. `npm test`: 314 pass
(`service/full.txt`); `npm run typecheck`: zero; `npm run test:package`: four pass.

## Unachieved gate and limits

Conservative count: **501 lines** (401 signer app, 100 signer-specific SDK helpers):
`wc -l apps/signer/src/*.ts packages/sdk/src/signing.ts packages/sdk/src/authority.ts packages/sdk/src/control-request.ts`.
Initial composition reached 506 before redundant-code simplification. SIG-11 is **not
achieved** under this recorded count. ADR-021 is proposed; no budget is changed or claim made
that dependent expansion is authorised. The human decision is HANDOFF H9.

This callable host factory still injects signing/RPC. Protected key/configuration loading,
executable packaging, dedicated-user mode, provider-health status, background reconciliation,
snapshots, full kills, upgrade and clean-machine deployment remain owed. Host RPC/signing
operations must themselves respect deadlines; graceful drain does not prove a hung host can
stop within the operational bound. Status is keyless but is not a readiness attestation.
