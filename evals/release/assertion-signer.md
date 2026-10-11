# Signer test assertion modification reasons

2026-10-11 Toronto · builder-authored scoped review/checks. CLAIMS S149.
Protected tests and product source unchanged; no independent evidence claim.

Read all nine complete signer test modification patches in S143's frozen
inventory, with their before/after/diff and current test hashes retained.
This reviews modification edges only, not initial additions, supporting child
fixtures, every signer source change or the complete history.

| Commit / test | Reason |
|---|---|
| f810612 / RPC | Add standalone-process completion proof within the existing deadline, preventing an unreferenced timer from silently ending the process. Earlier hung/expired-read checks remain. `evals/signer/rpc-deadline.md`. |
| 4af8e80 / socket | Stop trickle writes on received response bytes and parse on close, preserving timeout code and count bounds despite an EPIPE race. No absent response passes. Add completed half-open-slot exhaustion with a bounded read. `evals/signer/socket-slots.md`. |
| b7d24a5 / core | Add exact caller-report deadline forwarding and late-outcome refusal with no report persisted. Existing cases remain. |
| a40375a / handler | Give the stub its real proposal type. Add durable pre-admission refusal, payload binding, interrupted-refusal recovery, deadline retry and after-admission distinction; real executor/RPC error cases require no signing. `evals/signer/refusal.md`. |
| a40375a / socket | Retain oversized/UTF-8 frame cases and add incomplete oversized bytes plus a shorter configured timeout, so message bounds cannot mask removed framing bounds. Keep protocol/zero-dispatch checks; add core message-bound refusal. `evals/signer/refusal.md`. |
| 8b92594 / core | Add per-attempt recovery continuation, provider-loss/incomplete status, expired signed chain follow-up and failed response persistence without resend. Distinct payment bytes prevent the first in-flight intent from masking the second case. `evals/signer/recovery.md`. |
| f9c0cec / service | Add actual local service/client reply integration, stable duplicate proposal response, unresolved report hint and exactly one fixture send. Same-user mode is explicitly asserted. `evals/sdk/sending-client.md`. |
| 657e338 / RPC | Add unsafe endpoint/deadline, missing body, rate-limit, malformed lifetime/status, slot rollback and late-response refusal cases without removing prior checks. `evals/ci/coverage.md`. |
| 657e338 / socket | Add invalid timeout/report refusal and bounded unfinished-slot saturation; require typed busy response with no possible execution. Existing checks remain. `evals/ci/coverage.md`. |

Within this selection, replacements preserve their intended checks and additions
strengthen boundary evidence. Earlier receipts retain historical setup errors,
stalls and corrections. The recovery receipt explicitly records a scratch output
overwrite; this review cannot reconstruct or claim that lost output. Historical
results are not relabelled as current. No blanket fixture-cleanup or independent
review conclusion follows.

```sh
uv run --script evals/release/assertion-signer.py
node --test apps/signer/test/core.test.ts apps/signer/test/handler.test.ts apps/signer/test/rpc.test.ts apps/signer/test/service.test.ts apps/signer/test/socket.test.ts
npm run typecheck
```

Preserve the collection directory before regeneration. Current Node 26.7.0
focused checks pass all 73 cases without failure, skip, cancellation or todo;
typecheck exits successfully. These use fake RPC, synthetic in-memory signing
and local sockets/journals. Fixture send counts are not real chain execution.
No actual key file, live provider outage or dedicated-user isolation is tested.

Collector clearance flags remain false. No threshold, signer line-budget scope,
protected gate, public contract, accepted ADR or milestone changes. H9, H11,
H15, broader/independent review and stable qualification remain open.
