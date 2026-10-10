# Physical append completion before acknowledgement

Builder-authored local evidence, 2026-10-09 Toronto, Linux/Node 26.7.0,
base `72dde39` plus candidate. Accepted ADR-019; STO-1/2, SIG-8, OWN-2.

## Finding and correction

Both ownership modes acknowledge when a mocked write returns a full byte count
without writing, or an actual write is followed by an extra physical append.
Four negative cases fail first on the acknowledged sequence. This is fault
injection, not evidence that Linux normally reports bytes it did not write.

After complete write and sync, verify the descriptor size equals the previous
size plus the exact canonical entry bytes. Only then refresh expected metadata
and populate the cache. A disagreement fails the writer permanently, preserves
physical evidence and acknowledges no transition. Same-size privileged changes,
physical power loss and authenticated content remain outside this check.

The first source campaign stops at a moved sync-fault anchor. Preserve the
diagnostic and update only its insertion point, retaining the same swallowed-sync
fault. The next campaign misses a comparison that ignores the previous size.
Add positive nonempty-journal cases in both modes, and mirror them in the packed
consumer. All fifteen retained source faults then catch/restored; the checker
still requires behavioural assertions and the complete case count.

Definition 43/seed 43907 declares 562 selected cases before broader measurement,
retaining all prior sources/tests/floors/waits/process and product limits.

```bash
node --test --test-isolation=none packages/sdk/test/storage-failures.test.ts packages/sdk/test/ownership.test.ts
node evals/sdk/ownership-faults.ts
npm run typecheck
npm run release:prepare
node --test evals/packaging/packed-sdk.test.ts
node evals/packaging/faults.ts
npm test
npm run test:coverage -- --serial
uv run --script tools/session_close.py --slug codex-solanaut-1
```

## Status

Initial failures and fault misses live in `evals/sdk/record-write-completion/`.
All thirty-six focused cases and fifteen source faults pass with restored
baselines. Seventeen installed cases and all 868 native cases pass; typecheck
exits zero. Quiet serial AST executes 868: 867 pass and the unchanged real
staged-baseline wait fails. Complete coverage fails and no floor pass is claimed.
Preserve raw reports/output. All 136 retained compiled faults catch and the
restored seventeen-case consumer baseline passes. Final restored typecheck
exits zero. Bound product/evaluation/emitted-file/archive hashes match.
No stable milestone, independent audit or bounded-state claim. H9/H11 remain
pending. The prior runtime evidence is locally committed and its Git bundle,
exact clean clone and full integrity check verify. Close passes nine of ten,
with only unpushed HEAD failing under the explicit user instruction. No push.
