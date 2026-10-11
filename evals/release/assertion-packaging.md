# Selected package-consumer assertion reasons

2026-10-11 Toronto · builder-authored handoff review, not independent evidence.
Exact historical edges from S143. CLAIMS S145. Protected consumer tests unchanged.

The earlier broad display is truncated, so it grants no complete-history review.
Collect and inspect five selected full patches without truncation. Bind the
original inventory, both test-file revisions and each diff. This scope adds
explicit reasons for selected replaced assertions and fixtures; all remaining
package-test edits and other historical assertions still need review.

| Commit | Replaced assertion / fixture | Reason |
|---|---|---|
| 805e8bb | Exact output object gains the required oversized-signature refusal count | Retain every original sequence, immutability and typed-binding refusal field. Add proof that both signature domains refuse before oversized base64 decoding. `evals/sdk/checkpoint-signature.md`. |
| 6162efb | Factor signatures into a local value; expand required compiled files | Preserve the same checkpoint-binding verification and earlier file requirements. Add signed-envelope round-trip, size/tamper/canonical refusal checks and its JS/declaration files. `evals/sdk/checkpoint-envelope.md`. |
| 8a343d4 | Expand the corrupt-index fixture's try block and private imports | Retain the original typed lookup refusal and unchanged corrupt-pointer check. Add owned-admission collision/idempotency/immutability/capture and current-head-gap refusal checks; enforce that the internal method stays outside root exports. `evals/sdk/owned-request-admission.md`. |
| 4d9d1fe | Positive restored-owner close gains used-receipt refusal; child receives transfer bytes | Add valid/expired/captured redemption and restart reuse checks. Existing success/error/signal/output assertions and fifteen-second child deadline remain. The changed spawn line changes arguments, not its deadline. `evals/sdk/owned-redemption.md`. |
| 701372e | Startup mutation interception accepts Buffer results as well as strings | Preserve the original physical mutation, inode match and refusal; keep the fault effective after the raw-byte reader correction. Add inconsistent-length and genuine UTF-8-tail checks. `evals/sdk/record-read-completion.md`. |

In these selected patches, original checks are retained or extended with the
corresponding contract; no failed expectation is simply deleted. This is a
builder's scoped diff judgement, not proof of runtime correctness, fixture
containment on every failure, no weakened gate elsewhere or independent approval.
Existing receipts contain their original execution/fault evidence; this review
does not rerun or relabel those historical results as the current candidate.

```sh
uv run --script evals/release/assertion-packaging.py
```

Preserve the output directory before another collection. Complete selected
patches, old/new/diff hashes and the frozen selection are retained. The collector
is a data reader, not a release gate; it reports complete-history and independent
clearance false. No test, product, public contract, deadline, readiness target
or accepted ADR changes. H11, H15, the broader review and stable gates remain.
