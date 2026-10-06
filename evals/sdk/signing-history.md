# LIF-2 — durable signing evidence

Measured 2026-10-05, starting revision `425dcc8`; implementation is the commit containing this
receipt. Node 26.7.0, Keel 1.0.1, sensor v1. Builder-authored offline SDK evidence; no chain send.

`node --test packages/sdk/test/signing-history.test.ts`: nine initially failed on the missing
journal API, then nine passed. Raw evidence: `signing-history/signing-red.txt` and
`signing-history/signing-green.txt`. A fixture's Buffer/array type mismatch was corrected;
initial implementation errors lacked the expected actionable wording and were corrected without
widening assertions. The denied fixture's spread order was corrected before implementation.
Changed-byte fixtures were strengthened to carry a valid signature over different bytes, and
invalid-signature fixtures now match wire and declared signature, isolating cryptographic validation.

`node evals/sdk/signing-faults.ts`: seven separate faults caught; exact source restored in
`finally`, green baseline and restored battery. Raw summary: `signing-history/signing-faults.txt`.

| Fault | Behavioural assertion |
|---|---|
| skip redemption proof | no signed evidence before durable redemption |
| skip admitted-byte binding | valid signature over changed bytes refused |
| skip crypto verification | matching invalid signature refused |
| send before signed bytes | stage order refused |
| ignore lifetime | expired send refused |
| repeat send-started | no second send intent |
| repeat response | immutable durable response |

No missed fault in this battery. `npm test` passes 229 tests; typecheck exits zero; the compiled
packed SDK passes its consumer battery. Mutating batteries run sequentially.

`recordSigning(event)` is a trusted SDK journal API, not a socket method and not a broadcaster.
Each signing event shares the admission's sequence and hash chain. It is validated before append
and during restore/replay. Signed evidence requires request identity, allowed admission and durable
redemption; wire bytes and the sole signature must match and verify. Send intent requires signed
evidence, the active policy and bounded lifetime. Responses bind the signature and cannot repeat.
Denials also have durable responses. Durable redemption proof stays with historical requests even
when admission-window pruning removes the active receipt.

This foundation supplies no RPC, process isolation or automatic recovery executor. The signer must
still enforce authoritative observations and deadlines, persist send intent before the single
RPC call, never resend an ambiguous attempt and reconcile from chain evidence. These tests do
not qualify the full kill battery, power loss, snapshots, memory bounds or exactly-once execution.
The new signing helper is included in the future signer line accounting; it is not excluded merely
because it lives in the SDK. No existing test assertion was removed or weakened.
