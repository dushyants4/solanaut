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

The initial full suite retains these contract mismatches in sandbox evidence.
The new disclosure population separately tests callback order, detached data,
authentication, marker replay and all frozen denial classes. Historical reports
and their first failures are unchanged.
