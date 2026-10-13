# H11 — completion timing, not a stalled child

Builder-authored local diagnostic, 2026-10-10 Toronto, Linux/Node 26.7.0,
reviewed revision e7d92e1edeb86d6de2d9da36899d2e918f16341e.
No original source, test population, gate or command limit changes.

Fresh full native execution of the unchanged product passes 894 of 895 and
fails only the real staged-baseline wait. This reproduces H11 without applying
D40. Raw output is baseline-latency/native.txt; typecheck is separate.

Observe the existing `mutation-run.ts --start --baseline` once, with its original
definition, seed, selected tests, command and supervisor. The actual committed
result records status zero, no signal/error/timeout, and 22.223 seconds between
supervisor timestamps. All 573 staged cases pass. A sample near twenty seconds
is incomplete and its exact output bytes are retained. Original `--finish`
accepts the bound completion and reports a baseline, not a mutation score.

This run establishes natural progress/completion rather than deadlock. Test
duration output identifies actual restart, process-death, local RPC and benign
traffic work. Its local HTTP 429 fixture is intentional, not public-devnet
rate limiting. Do not remove these cases or change workload definitions to
meet a harness wait. A single sample does not establish a latency distribution,
machine independence or the sufficiency of any proposed future wait.

The exact unapplied owner-wait.patch contains H11's proposed sixty-second wait
and updated diagnostic only. Read-only application validation succeeds. Generate
a scratch copy with those two edits and three relocated imports; the original
backend remains. All six original recovery tests pass in that review copy,
including actual completion, repeated finish and original integrity refusals.
Original file digest stays 30cb59765c989bbc9237c562c7b5be1a306bab5c6a847eecdf0d744e393377de.
This is proposal evidence, not human acceptance or an actual maintained-gate pass.

```bash
npm test
node evals/ci/baseline-latency/observe.mjs
uv run --script evals/ci/baseline-latency/generate-proposal.py
node --test .sandbox/solanaut-1/status-diagnostic/proposed-wait.test.ts
git apply --check evals/ci/baseline-latency/owner-wait.patch
npm run typecheck
```

The observer has a separate containment limit and uses the existing teardown
helper if incomplete; it never changes the supervised command's original limit.
Its owned supervisor/child are 4011017/4011024, with ticket and structured result
retained. Raw stage manifest/spec/ticket/output/commit/result, sampling records,
top durations and generated-copy identities are archived. All original bound
product/evaluation/emitted hashes match afterwards. No security, runtime matrix,
complete CI, performance, milestone or stable-release qualification follows.

The measured observer source is preserved verbatim. The regenerating helper
adds input preflight and reads actual Git HEAD, preventing later different source
from being labelled as this revision. `node evals/ci/baseline-latency/observe.mjs
--check-inputs` confirms those prerequisites without launching another workload.
No fresh timing result is attributed to that preflight-only invocation.

## Applied, 2026-10-13

The human accepted H11 on 2026-10-13, after Claude's review (`docs/reviews/2026-10-13-codex-leg3.md`). Claude applied
`owner-wait.patch` unchanged: the wait is 60,000 ms, and the diagnostic reads "configured harness wait". Nothing else in
the test changed.

- **Before:** `npm test` on a fresh clone of `c7ba219` passed 900 of 901. The one failure was this wait
  (`runs/2026-10-13-public-bridge.md`).
- **After:**
  - `node --test evals/ci/mutation-recovery.test.ts` passes 6 of 6, and the staged baseline finished in 24.6 seconds;
  - `npm test` passes 901 of 901, in 150 seconds;
  - `npm run typecheck` passes.

  Run with `TMPDIR` under `.sandbox/`.

The hosted runtime matrix, the AST floors and the maintained fault campaigns still need their own passes. O2, O3 and the
job limits are separate work.
