# LIF-3 — conservative signer executor

Measured 2026-10-05, starting revision `948d6a5`; implementation is the commit containing this
receipt. Node 26.7.0, Keel 1.0.1, sensor v1. Builder-authored tests, fake RPC and ephemeral
in-memory crypto keys. No real chain send or process-isolation qualification.

`node --test apps/signer/test/core.test.ts`: six initial tests fail against a stub, then pass.
Six further failure-boundary tests were added after the executor and passed initially; they
are additional regression evidence, not initial red-first evidence. The complete battery passes
twelve tests. Raw logs: `core/core-red.txt`, `core/core-extended-green.txt`.

`node evals/signer/core-faults.ts` catches five mutations, restores exact source after each and
checks the restored battery. Evidence: `core/core-faults.txt`.

| Fault | Behavioural rejection |
|---|---|
| ignore deadline | expired/oversized deadline rejection |
| ignore completed payload binding | changed bytes under old identity rejected |
| invent landed outcome | absent chain evidence records no outcome |
| send without persisted intent | side-effect boundary and fake send inspect durable record |
| forget durable response | completed retry must return its original answer |

The initial outcome mutation attempted assignment to a constant; the runner refused to count it
(`core/core-fault-invalid.txt`). The response mutation caused unexpected rejection but no explicit
assertion diagnostic, which the conservative runner also refused (`core/core-fault-classification.txt`).
The outcome mutation was corrected; the retry test now explicitly asserts no rejection as well as
answer equality. No gate or assertion was weakened, and neither initial run is counted as a caught
security fault. No fault missed after those corrections.

`npm test` passes 241 tests; `npm run typecheck` exits zero. Mutation batteries run sequentially.
Current source count: `wc -l apps/signer/src/*.ts packages/sdk/src/signing.ts` reports 156 lines,
including the new SDK signing helper. This partial count does not qualify the final SIG-11 budget;
all future process helpers remain counted against its unchanged 500-line limit.

The executor coalesces same-payload in-flight requests, validates deadlines for new work, returns
durable completed responses and refuses identity reuse. Admission can resume; redeemed-without-wire
becomes uncertain and never signs again; signed-without-send can resume within lifetime; send-started
becomes uncertain and never resends. Signing and send intent are synced before their next side effect.
Send errors or contradictory signatures retain uncertainty. A lost response after successful send
is reconstructed without another send. Deadline expiry during signing preserves wire but starts no send.
Reports read chain evidence through the supplied RPC interface and never take an outcome from the caller.

Remaining: authoritative two-provider RPC implementation, source/clock/mode records, durable protected
configuration, Unix transport, actual kill batteries, installed signer artefacts and dedicated OS user.
Restarts here reconstruct record prefixes; they are not SIGKILL or power-loss measurements. Full request
history remains in memory. The executor is not yet an operational isolated signing product.
