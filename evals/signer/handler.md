# Durable method handler — LIF-4 / SIG-2/3/4 foundation

Measured 2026-10-05 from `4af8e80`; implementation is the commit containing this receipt.
Node 26.7.0. Builder-authored real-journal/fake-host evidence; no key or chain send.

Initial combined battery: eight failures and twelve passes (`handler/red.txt`). Seven handler
cases fail against the stub; a new core regression observes the wrong report deadline. Its early
assertion blocks the late-outcome assertion initially; the planted late-outcome fault establishes
that negative evidence. Three additional handler cases initially pass after implementation;
mutations verify late-status and concurrent-namespace boundaries.

`node --test apps/signer/test/handler.test.ts apps/signer/test/core.test.ts` passes twenty-three
cases (`handler/green.txt`): ten handler and thirteen core. Control starts persist before work,
same active payload coalesces, completed answers return before checking retry deadlines, and new
invalid/expired deadlines produce immutable denials. Report hints read host evidence; unavailable
work returns a fixed stored code. Reply write failure throws and closes admission. Core report
now accepts the request deadline, validates before reading and again before recording an outcome.
Background reconciliation keeps its bounded default.

`node evals/signer/handler-faults.ts` catches seven mutations (`handler/faults.txt`). The first
run rejected the cached-answer mutation because an unexpected rejection was not an explicit
assertion (`handler/fault-run-error.txt`). Added `doesNotReject`, keeping the answer comparison.
Moved forwarded-deadline observation outside the throwing host callback: the handler deliberately
catches host errors, which can mask assertions inside it. No miss remains in the final battery.
A closure-narrowing type error was corrected with an explicit method union. A documentation patch
failed its context match and applied nothing; corrected separately.

`node evals/signer/core-faults.ts` catches six mutations, including the new late-outcome fault
(`handler/core-faults.txt`). Maintained selectors follow the deadline argument. Exact source
restored throughout. `npm test`: 289 passes. `npm run typecheck`: exits zero.
Unchanged signer budget: 500 lines; current partial app/extracted-helper total: 434:
`wc -l apps/signer/src/*.ts packages/sdk/src/signing.ts packages/sdk/src/authority.ts packages/sdk/src/control-request.ts`.

This is host wiring, not an operational service. Safe status projection, protected configuration
and key loading, persistent signed-policy enforcement, recovery supervision, dedicated-user access
and installed deployment remain owed. Proposal errors before admission are not journalled;
complete request idempotency is not established. History remains in memory pending the disk index.
Fake host actions do not establish chain trust or full kill qualification.

Socket correction `4af8e80` passed CI `37404939530` on Node 22.18.0, 24 and 26.7.0.
This revision's matrix remains separately required.
