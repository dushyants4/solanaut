# Private owned-guard assertion history reasons

2026-10-11 Toronto · builder-authored scoped review/checks. CLAIMS S148.
No protected test or product changes; no independent review claim.

Read the five complete modification patches for `owned-guard.test.ts` in S143's
frozen inventory. Preserve full patches, before/after/diff hashes and current
test identity. This covers that test's modification edges, not its initial
addition, every supporting fixture/source or the complete project history.

| Commit | Reason |
|---|---|
| 944579d | Add changed-payload identity refusal and actual descriptor-write failure with fixed error redaction, unchanged sequence and permanent failed-writer refusal. Existing caller-byte capture and same-payload retry checks remain. `evals/sdk/owned-admission-error.md`. |
| 4d9d1fe | Add only `redeem` to the exact private surface; retain frozen/no-exposed-guard/store/entries assertions. Add queued shared-byte capture, observation order, restart single-use, lifetime/foreign-byte refusal and durable-write failure checks. `evals/sdk/owned-redemption.md`. |
| 7a64856 | Add only `release` and `releaseText` to that surface. Require queued captured signatures, preserved reservations, signed scope/expiry refusal and latch retention after failed writes/restart. `evals/sdk/owned-release.md`. |
| 4addaa4 | Add only private `report` to that surface. Check all outcomes, caller attribution, durable time, receipt reuse refusal, FIFO/close ordering, coercion refusal and unresolved reservation after write failure/restart. The paused-read fixture releases its gate in `finally`; its earlier stall remains in the receipt. `evals/sdk/owned-report.md`. |
| f1e253f | Add only private `recordSigning` to that surface, matching the separately tested queued journal operation. Retain all existing immutability and hidden-history assertions. `evals/sdk/owned-signing.md`. |

No surface element is removed in these changes. The added methods are private
trusted SDK operations, not root exports or new signer socket methods. The
report tests explicitly require caller attribution; they do not establish RPC
authority. Scope, durability and gate limits in the original receipts remain.
This review does not establish complete fixture cleanup under every injected
failure, no historical weakening elsewhere or independent approval.

```sh
uv run --script evals/release/assertion-owned.py
node --test packages/sdk/test/owned-guard.test.ts
node --test packages/sdk/test/owned-signing.test.ts
npm run typecheck
```

Preserve the collection directory before regeneration. Current Node 26.7.0
checks pass all 23 owned-guard cases and all nine separate signing-journal cases,
with no failure, skip, cancellation or todo; typecheck exits successfully.
Raw current outputs are separate from the historical first failures/faults.
These use local temporary journals and synthetic in-memory signing fixtures,
not actual key files, chain sends or dedicated-user isolation.

The collector is data-only and leaves complete-history, independent and release
clearance false. No accepted ADR, wait, threshold or formal milestone changes.
H11, H15, broader/independent review and stable qualification remain open.
