# Coverage assertion modification reasons

2026-10-11 Toronto · builder-authored scoped review/checks. CLAIMS S151.
No protected test, coverage checker or product source changes.

Inspect all thirteen complete modification patches for `coverage.test.ts` in
S143's frozen inventory. Before/after/diff hashes and current test identity remain.
This reviews that test's modification edges, not its initial addition, every
instrumentation/helper change, actual candidate coverage or independent approval.

| Commit | Reason |
|---|---|
| afa0b21 | Add a checkpoint critical-file deficit with passing aggregate evidence, requiring the isolated deficit to refuse. `evals/sdk/checkpoint.md`. |
| 40fa2fc | Preserve that case and extend the same deficit loop to checkpoint archives; require the diagnostic to name the specific tested file. |
| 23f57d5 | Add checkpoint prefix to the retained critical-file loop. |
| b9c06eb | Add checkpoint state to the retained loop. |
| 6d81f8b | Add checkpoint bundle to the retained loop. |
| 6162efb | Add checkpoint envelope to the retained loop. |
| 0c61fa3 | Add checkpoint publication to the retained loop. |
| f05c84d | Add checkpoint recovery to the retained loop. |
| c2c2f5c | Add archive to the retained loop. |
| 39c24de | Add request index to the retained loop. |
| 5a33e69 | Add request-index publication to the retained loop. |
| 0332c97 | Add firewall to the positive inventory, exact statement/branch floor deficits and isolated critical deficit masked by a large passing helper. Retain SDK/signer cases. `evals/firewall/filter.md`. |
| 36a1ae7 | Add private owned guard to the retained critical-file loop; earlier cases and deficit remain unchanged. `evals/sdk/owned-guard.md`. |

These replacements extend the tested file population; none removes a previous
critical-file expectation or changes its deficit/floor. Passing aggregate fixture
values isolate the per-file failure rather than replacing it with an unrelated
aggregate refusal. Historical receipts retain initial missing-designation failures
and later full-run failures. This review supplies no fresh instrumented coverage
or proof that every checker/inventory source revision was sound.

```sh
uv run --script evals/release/assertion-coverage.py
node --test evals/ci/coverage.test.ts
```

Preserve the collection directory before regeneration. Current Node 26.7.0
controls pass all five cases with no failure, skip, cancellation or todo; raw
output remains. These synthetic counter/inventory cases are not measured SDK,
signer or firewall coverage. No TypeScript source/test changes follow S149's
successful typecheck; this review does not rerun unchanged full qualification.

S150's earlier frozen reference map does not yet index this receipt; preserve its
counts as that checkpoint's scope. Broader/independent/public-history review,
H11 and stable qualification remain open. Collector clearance flags stay false;
no deadline, threshold, accepted ADR, protected gate or milestone changes.
