# Private queued trusted SDK outcome reporting

Builder-authored local evidence, 2026-10-09 Toronto, Linux/Node 26.7.0,
base `ae6ba56` plus candidate. Accepted ADR-019; SNP-5/7, STO-1.

The private facade queues trusted SDK reporting with proposal/control/redemption/
operator work, observations and close. Primitive hash/outcome checks refuse
caller coercions. Delegate the existing durable report path; storage failure
returns the fixed facade error and retains the unresolved reservation. Recorded
time is the latest journal time at queue execution. Attribution remains `caller`.
This adds no root export, socket method, signing, send or authoritative RPC read.
An isolated client report is still a hint requiring chain evidence.

Seven absent-method cases fail first; all previous sixteen cases pass. The first
FIFO fixture stalls because it does not release its artificial paused read on an
absent-method assertion. Stop only that test process and preserve partial output;
release its gate in `finally`. The corrected first-red run executes all cases,
with seven failures and no cancellation. The frozen-surface assertion adds only
the explicit private report method; mutable guard/history exposure stays denied.

All 23 focused cases, 39 retained facade source faults, nineteen installed cases
and 879 native cases pass, with typecheck zero. Definition 45/seed 45691 retains
573 selected cases and all previous inputs/limits before measurement. Quiet
serial AST executes 879: 878 pass and the unchanged real staged-baseline wait
fails. Preserve raw reports/output; no complete coverage/floor pass is claimed.
All 144 retained compiled faults catch; the restored nineteen-case consumer
baseline and final typecheck pass. All 51 product, 87 evaluation and 86 emitted
file hashes, plus the separate private archive digest, match after restoration.
Tests cover
all four outcomes, restart/repeated unknown,
final refusal, used receipts, malformed/foreign/denied decisions, coercion refusal,
FIFO time/order/close and actual append failure/recovery. No independent security,
isolated reporting, bounded recovery or stable milestone claim.

```bash
node --test --test-isolation=none packages/sdk/test/owned-guard.test.ts
npm run typecheck
node evals/sdk/owned-guard-faults.ts
npm run release:prepare
node --test evals/packaging/packed-sdk.test.ts
node evals/packaging/faults.ts
npm test
npm run test:coverage -- --serial
```

The preceding crash receipt is locally committed; verified bundle and exact
clean clone/full integrity check pass, with clean close failing only unpushed
HEAD. All work remains local, H9/H11 pending. No remote push.
