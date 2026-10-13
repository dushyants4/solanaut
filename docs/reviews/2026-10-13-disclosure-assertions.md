# Assertion changes for the accepted denial contract

Builder record, not independent review. ADR-025 intentionally replaces agent
error fields; it does not relax admission, cleanup or recovery behaviour.

| File | Changed assertion | Safety checks retained |
|---|---|---|
| `packages/sdk/test/adapters.test.ts` | Rule/reason/decision assertions read the operator callback; default errors must omit those fields and carry the expected class/reference. RPC exception text becomes a fixed operator reason and `retry-later`. | Exact denied rules, policy-versus-adapter verdict agreement, unsigned cleanup, signature verification, report outcomes, reservation retention and prohibition on wallet broadcasting. |
| `packages/sdk/test/adapter-wire.test.ts` | Wire refusals require private class errors plus exactly one operator callback naming `wallet-changed-message`. | No RPC calls, stripped signatures, unknown reports, in-flight reservations, and captured wire sent once. Private exception sentinel remains absent. |
| `packages/sdk/test/adapter-buffer.test.ts` | Mutated-buffer refusals use the operator rule and a class-only error. | Mutable legacy/versioned buffers cannot reach RPC; successful wire capture remains private and byte-identical. |
| `apps/signer/test/service.test.ts` | Policy version is asserted in operator status and absent from agent status. | Deployment attribution, signed restore/replay, durable retries, single send, ownership and close draining. |
| `packages/sdk/test/sending-client.test.ts` | Denied/pre-admission results use frozen classes and valid references. Old shapes become negative cases. | Uncertain signed and unsigned responses remain distinct; strict framing, no resend and execution uncertainty checks remain. |
| `apps/signer/test/socket.test.ts` | Fixed transport codes become exact class/reference objects; busy/timeout remain temporary, framing/method failures invalid and unknown handler failures refused. | Every original framing, unknown-method, identity, timeout, slot limit, cleanup and no-dispatch check remains, with the original named-test population. |

The client's remote-error test now requires validated class/reference fields;
legacy code/private-message fields become protocol-negative cases. It retains
the original named-test count and all earlier uncertainty and non-leak checks.

The initial full suite retains these contract mismatches in sandbox evidence.
The new disclosure population separately tests callback order, detached data,
authentication, marker replay and all frozen denial classes. Historical reports
and their first failures are unchanged.
