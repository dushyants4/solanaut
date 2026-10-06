# Unix socket boundary — SIG-1/2/3/8/10 foundation

Measured 2026-10-05, starting revision `f810612`; implementation is the commit containing
this receipt. Linux, Node 26.7.0. Builder-authored tests; no key or chain send.

Before implementation, six of eight tests fail against the unimplemented response stub;
existing-path checks already pass (`socket/initial-red.txt`). Two additional tests fail
against the first implementation: trickling bytes extend the activity timeout, and oversized
results escape the response bound (`socket/additional-red.txt`). The bigint response branch
was initially masked by the oversized fixture; both now run. The abandoned-process case was
added after implementation and initially passed; it is not red-first evidence.

`node --test apps/signer/test/socket.test.ts` passes eleven cases (`socket/green.txt`).
Transport accepts one canonical JSON object plus newline, bounded to 16,384 bytes, and
responds once within an absolute connection deadline at most thirty seconds. Exact method
field sets and bounded IDs are validated. Only propose/report/status dispatch. Responses have
the same byte bound; errors and unserialisable results produce fixed codes, not exception text.
The parent is real, owned and mode 0750; socket mode is 0660. Live listeners, symlinks and
ordinary files are refused. A killed child leaves a socket that can be recovered.

`node evals/signer/socket-faults.ts` catches seven valid mutations (`socket/faults.txt`).
The first run failed to classify its permission fault: a negative assertion left an unexpected
server open, preventing the test summary (`socket/fault-run-error.txt`). Strengthened fixture
cleanup rather than weakening the runner. The frame fixture now uses a complete valid oversized
request, so removing the bound fails an assertion rather than hanging. Source restored after
every mutation, including the unsuccessful run. No remaining missed fault in this battery.

Budget stated before this step: 500 lines for the signer. Current partial total is 362:
`wc -l apps/signer/src/*.ts packages/sdk/src/signing.ts packages/sdk/src/authority.ts`.
This includes the extracted SDK journal and attribution helpers. Final budget remains required.
`npm test`: 268 passes. `npm run typecheck`: exits zero.

This is a transport helper, not the operational service. Its caller must already hold exclusive
record kernel ownership before abandoned-socket recovery. Durable all-method identities,
host clock, signed policy and protected key loading must be wired. Dedicated-user access,
competing service starts, full lifecycle kills and installed-package qualification remain owed.
Closing a timed-out connection does not cancel core work already dispatched; the journal governs
retry and recovery, and uncertain sends are not automatically resent.

Corrected RPC revision `f810612` passed CI `37403526901` on Node 22.18.0, 24 and 26.7.0,
including the standalone deadline regression. This step's matrix is separately required.
