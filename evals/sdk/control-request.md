# Durable control requests — LIF-4 foundation

Measured 2026-10-05 from `7b55b37`; implementation is the commit containing this receipt.
Node 26.7.0, builder-authored evidence. No key, RPC or chain send.

`node --test packages/sdk/test/control-request.test.ts` first fails all nine cases because
the journal APIs do not exist (`control-request/red.txt`). Fixture setup blocks the initial
negative cases too; valid mutations establish their behavioural failure evidence. After
implementation all nine pass (`control-request/green.txt`).

Status/report starts bind guard/client/ID, method and canonical payload in the admission chain.
Starts precede work; a separate immutable response is recorded before returning. Payloads are
exactly an empty status object or a report decision hash. Responses are copied into bounded
canonical JSON; reads return independent decoded copies. SDK methods do not perform the work,
sign or broadcast. A pending start has no answer and can be resumed by a future service.
Control and proposal methods share one identity namespace. Restore/replay reject altered
bindings, duplicated starts, unknown starts and duplicated responses. These entries advance
record time and sequence but never tick Keel, create reservations or count as denials.

`node evals/sdk/control-request-faults.ts` catches all eight valid mutations; source restored
after each and the restored battery passes (`control-request/faults.txt`). No missed fault in
this run. `npm test`: 277 passes; `npm run typecheck`: exits zero; `npm run test:package`:
four installed SDK checks pass outside the repository.

The unchanged signer budget remains 500 lines. Partial app/helper count is 390:
`wc -l apps/signer/src/*.ts packages/sdk/src/signing.ts packages/sdk/src/authority.ts packages/sdk/src/control-request.ts`.
The existing SDK engine is outside that process budget under ADR-019; extracted signer helpers
are included transparently. Final operational count remains owed.

This does not yet wire socket methods, their deadlines or concurrent execution. Proposal RPC
failures before admission still need a durable response path; the operational handler must not
claim complete request idempotency until that gap is closed. Response schemas/projection are
trusted host responsibilities; never store principal material in status. History remains in
memory pending the accepted disk index/snapshot work. Existing format-v1 readers refuse these
new entry kinds, so upgrade compatibility must be checked before resuming an older binary.

Socket revision `7b55b37` passed CI `37404207616` on Node 22.18.0, 24 and 26.7.0.
This step's matrix and the independent security/reliability programmes remain required.
