# Pre-admission proposal refusals — LIF-5 / SIG-2/3

Measured 2026-10-06 from `b7d24a5`; implementation is the commit containing this receipt.
Node 26.7.0, Linux. Builder-authored evidence, with real executor/journal and fake RPC.
No key-file read, real chain send or publication.

Initial handler/socket battery: four failures and 23 passes (`refusal/red.txt`). Proposal
errors leave no durable answer; an interrupted refusal cannot restore; deadline failures throw;
the transport accepts a message larger than the core bound. The after-admission negative case
already passes; mutation evidence checks its preserved error route. An additional real-executor
integration case was added after implementation and initially passes; it is not red-first evidence.

`node --test apps/signer/test/handler.test.ts apps/signer/test/socket.test.ts` passes 28 cases:
15 handler and 13 socket (`refusal/green.txt`). A pre-admission error records a non-admission
request payload and fixed denial answer. The same payload returns that answer even after its
deadline; changed message/group or method is refused. A refusal start interrupted before its
answer completes conservatively without calling the executor again. An error after a decision
remains owned by the signing journal; it cannot manufacture non-admission evidence. Malformed
base64 and RPC failure from the actual executor produce refusals without signing or admissions.

The trusted host journal now accepts propose payloads only as non-admission bookkeeping,
exactly `{message, group}` with bounded string message and null/bounded string group. It does
not perform an admission. The socket refuses messages beyond 8192 characters before dispatch;
such invalid frames have no durable identity. Refusal codes distinguish deadline from unavailable
work; finer actionable decoding/provider errors remain product work. Reservations are untouched.

`node evals/signer/handler-faults.ts`: nine faults caught (`refusal/handler-faults.txt`).
`node evals/signer/socket-faults.ts`: nine caught (`refusal/socket-faults.txt`).
`node evals/sdk/control-request-faults.ts`: eight caught (`refusal/control-faults.txt`).
Exact source restored after every mutation. No missed fault in these runs. Before mutation,
strengthened the frame fixture with an oversized incomplete frame and short configured timeout:
the new message bound would otherwise mask removal of the framing bound. The expected protocol
code is unchanged. A test helper's inferred zero-argument proposal signature failed typecheck;
gave it the real Proposal argument type. No production threshold or gate changed.

`npm test`: 295 passes. `npm run typecheck`: exits zero. `npm run test:package`: four installed
SDK checks pass outside the workspace. Signer budget unchanged at 500 lines; current partial
app/extracted-helper total 453:
`wc -l apps/signer/src/*.ts packages/sdk/src/signing.ts packages/sdk/src/authority.ts packages/sdk/src/control-request.ts`.

Operational service enforcement, safe status projection, protected key/configuration, actual
kill/outage/isolation batteries, snapshots/index and independent review remain owed. Journal
fixtures are not full SIG-8 qualification or exactly-once chain execution. Existing readers that
do not accept propose refusal entries cannot roll back over that history.

Parent revision `b7d24a5` passed CI `37405479424` on Node 22.18.0, 24 and 26.7.0.
This step's matrix remains separately required.
