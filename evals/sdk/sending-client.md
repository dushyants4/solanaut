# Explicit sending client — CLT-1 to CLT-4

Measured 2026-10-06, Node 26.7.0, Keel 1.0.1/sensor v1. Revision: commit containing
this receipt (`git log -- evals/sdk/sending-client.md`). Builder-authored local sockets,
fake RPC, memory-only service keys; not independent qualification or live-chain evidence.

## Failed first

Eight cases fail against the stub (`sending-client/red.txt`). Initial implementation is
refused by native TypeScript because it used constructor parameter properties; typecheck
also catches a socket data union. Corrected to erasable syntax and explicit byte conversion
(`sending-client/native-error.txt`). A later identity-mutation case fails: response checking
reads the caller's mutable request ID. Capturing it before connecting closes that race
(`sending-client/identity-red.txt`); no assertion weakened.

Packed consumer checks initially fail against the stale candidate lacking the new exports
(`sending-client/package-red.txt`). Rebuilding the release-only candidate produces passing
installed JavaScript and declaration checks outside the monorepo, with no loader flags.

## Passing and planted faults

`node --test packages/sdk/test/sending-client.test.ts apps/signer/test/service.test.ts`:
nineteen pass (eleven client, eight service), `sending-client/green.txt`. The service case
uses the actual composition, verifies immutable retry response, report and status, with
one fake send. The existing partial-signing adapter is unchanged.

`node evals/sdk/sending-client-faults.ts`: ten faults caught, including an actual second
connection/write on a lost reply. Other faults cover response ID, canonical envelope,
response bound, ambiguity, before-connect attribution, timeout, message bound, caller ID
race and invalid signature shape. Source restored and battery rechecked. No final miss.
The trickle fixture has a separate cleanup ceiling so a broken client cannot hang a fault
run; the client timeout assertion remains unchanged.

`node evals/signer/service-faults.ts`: eight existing faults still caught after adding
the client/service case. `npm run test:package:faults`: four damaged candidates still
rejected; runner counts updated to the expanded installed battery. Outputs retained here.
`npm test`: 326 pass (`sending-client/full.txt`); `npm run typecheck`: zero;
`npm run release:prepare` then `npm run test:package`: five pass
(`sending-client/package-green.txt`). Private staging, no publication or version claim.

## Limits

Client errors are conservative: after a proposal write, failure may mean execution, even
if the peer explicitly refused it. This is not proof of execution or exactly-once delivery.
Only caller-selected manual retries exist; the same ID/payload must be retained. Sending
success is not landing. Signature validation is shape validation, not cryptographic chain
evidence; the signer journal performs that verification. Status is bounded but extensible.
Further packet fragmentation, full installation, live chain/provider and framework evidence
remain owed. The consumer adapter is not signer-host code and contains no signing key.
SIG-11/ADR-021 remain unchanged and pending as recorded in the service receipt.
