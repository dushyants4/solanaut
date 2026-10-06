# SDK request identity foundation

> **Draft 3** · 2026-10-05 · owner: integrator · for: SDK consumers and signer developers.
> Evidence: `evals/sdk/request-identity.md`, claim S17. Register: `kb/DOCUMENTS.md`.

The optional second argument identifies an admission:

```ts
const decision = guard.check(proposal, { clientId: "agent-a", id: "payment-2026-10-05-a" });
```

Client and request IDs contain ASCII letters, digits, dots, underscores, colons or hyphens,
and must be nonempty and bounded by the API validator. The guard supplies its own namespace.
The payload is the exact message bytes and optional grouping key. Time, heights and future
transport deadlines are observations, not caller payload. Do not reuse an ID for a new payment.

The identity and digest are committed in the same decision entry as the reservation. A retry
returns the original admission or denial before evaluating again. Changed bytes or grouping
return a fail-closed denial whose reason identifies identity reuse; they create no new admission.
This optional SDK path remains trusted and advisory, like the rest of SDK mode.

An old allowed answer is not a new receipt. Redemption still rejects used, expired or released
receipts. The isolated sending client must consult the durable lifecycle rather than sign or
send again when it sees an allowed duplicate. That client, transport deadlines, signed-byte
storage and send recovery are not implemented by this foundation. No method here broadcasts.

Restore and replay validate bindings and refuse duplicate history. Request history currently
remains in memory; the release's disk index and bounded-memory qualification remain owed.

The trusted SDK API `guard.recordSigning(event)` records `signed`, `send-started` and `response`
facts in the same chain. It neither signs nor broadcasts. Signed wire evidence requires a redeemed
request admission and verifies its sole signature over the exact message. Send intent requires
the current policy and an unexpired bounded lifetime. Responses are immutable and bind the
recorded signature. Validation also runs on restore/replay (`evals/sdk/signing-history.md`, S18).
The isolated executor, transport deadlines and chain reconciliation are still owed.

The trusted SDK also journals non-admission requests (S24):

```ts
const start = guard.beginRequest({ clientId: "agent-a", id: "status-a" }, "status", {}, hostTime);
const old = guard.requestResult(start.hash);
if (old === undefined) guard.finishRequest(start.hash, safeStatusProjection);
```

`report` payloads are exactly `{ decision: "<decision hash>" }`. A differing method or payload
under a proposal or control ID is refused. A completed answer cannot change; results are copied
and bounded, and callers must use a new ID for a fresh status. The start is durable before work,
and the response is durable before answering. These APIs are host bookkeeping, not socket
methods, and neither API signs or broadcasts. Deadlines and concurrent execution still need
operational wiring. The response projection must contain no key material. Older binaries that
do not understand these record entries cannot roll back over this history.
