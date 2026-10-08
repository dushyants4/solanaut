# Sending client

> **Draft 2** · 2026-10-08 · owner: integrator · for: Node SDK consumers.
> Register: `kb/DOCUMENTS.md`. Private candidate; installation and isolated deployment
> remain under development. Local evidence: S31, `evals/sdk/sending-client.md`.

`createSendingClient` connects to the signer's protected Unix socket. It exposes exactly
`propose`, `report` and `status`. `propose` asks the signer to admit, sign and send; the
existing `guardedSigner.signTransactions` remains a partial-signing SDK operation.

```ts
import { createSendingClient, SignerClientError } from '@solanaut/sdk';

const client = createSendingClient({
  socket: '/run/solanaut/signer.sock',
  clientId: 'payments-agent',
});
const answer = await client.propose({
  id: 'rent-payment-2026-10-06',
  message: messageBytes, // Already-built transaction message, not signed wire bytes.
  group: 'rent',
});
```

Keep the chosen ID and exact bytes/group through uncertainty. A different payment needs
its own ID. IDs follow the signer's identity alphabet. Each call uses a fresh connection;
the client does not automatically reconnect or retry a request.

An admission answer includes a decision hash and `denied`, `sent` or `uncertain` status.
`sent` does not mean landed. A pre-admission refusal instead contains a fixed `deadline`
or `unavailable` code. A denied admission's named rule is in its decision record; this
reply does not yet include the full decision. `report({ id, decision })` asks the signer
to read authoritative outcome evidence and returns a final outcome or `unresolved`.
Callers never supply outcomes. `status({ id })` returns the host's keyless projection;
check its mode and limitations rather than treating it as an isolation attestation.

`SignerClientError` exposes `code`, `mayHaveExecuted` and an optional fixed `remoteCode`.
Missing arguments, primitive values and array/function containers are refused
before field access or transmission with `input` and `mayHaveExecuted: false`.
Valid object fields still undergo identity, message, grouping and deadline checks.

| Code | Meaning | Operator/client action |
|---|---|---|
| `input` | invalid configuration or payload; no transmission | correct the input |
| `connection` | connection failed or closed without an answer | inspect uncertainty and signer status |
| `timeout` | client's absolute wait ended | keep the request ID/bytes; reconcile before new work |
| `protocol` | reply shape, identity or framing failed validation | treat the endpoint as unavailable and inspect diagnostics |
| `remote` | peer returned a bounded transport refusal | inspect the fixed remote code and endpoint health |

If `mayHaveExecuted` is true, preserve the request and inspect/reconcile it. Never create
a new ID merely to retry that payment. False means this client did not transmit a proposal;
it does not prove another client never did. Peer exception text is discarded.

The default transport timeout is the specified thirty-second bound; `timeoutMs` may shorten
it. Optional `deadline` is the absolute request deadline. Completed same-ID answers can be
looked up with an old deadline; the signer decides whether a request is new. Activity does
not extend the client's timer. Message/response bounds follow the existing socket contract.
These interfaces are included in the private compiled SDK candidate (`docs/PACKAGING.md`);
no npm package is published by this work.
