# Wallet batch and RPC privacy fixes integrated

2026-10-13 Toronto · builder-authored Node 26.7.0/Linux evidence. Starting
revision 6fd36da9308d1d244450b894832538a568bac3b6; implementation is the commit
containing this receipt. Claim S157 covers the local counts below.

Both live fence probes refuse; no file appears. Baseline passes 901 tests and
typecheck. The preserved batch-membership and RPC-redaction fixtures become
ordinary product regression tests. Before correction their combined population
passes two/fails five: three batch edits and two diagnostic disclosure paths.
Earlier first-failure/candidate receipts remain unchanged.

The exact prepared corrections now run in the product: wallet membership is
captured before awaiting and copied before delegation; provider/send diagnostics
retain fixed categories without propagating raw exception text. The combined
adapter/RPC check passes 55 tests. Full `npm test` passes 908 with no failures,
skip, cancellation or todo; typecheck passes. The existing RPC campaign still
catches its eight faults and restores its source.

Five new omissions are caught: caller capture, wallet copy, signed reservation,
provider redaction and send redaction. Exact source bytes are restored and all
seven new regression cases pass afterwards. The first diagnostic runner expected
only AssertionError; the caller-copy omission correctly raised SolanautDenied.
Preserve that initial output/script, then accept that exact refusal for that one
fault. No product assertion, deadline or population is weakened.

```sh
npm test
npm run typecheck
node --test packages/sdk/test/adapter-batch.test.ts packages/sdk/test/adapter-buffer.test.ts packages/sdk/test/adapter-wire.test.ts packages/sdk/test/adapters.test.ts apps/signer/test/rpc.test.ts apps/signer/test/rpc-redaction.test.ts
uv run --script evals/release/integrated-fixes-faults.py
node evals/signer/rpc-faults.ts
```

Preserve existing fault output before regeneration. Raw output stays under
`.sandbox/evidence/2026-10-13-development/`; exact byte counts/SHA-256 are in
`integrated-fixes-inputs.json`. No hosted logs are copied. Tests use synthetic
keys/fake RPC; this is neither actual chain execution nor isolated deployment,
independent evaluation or stable release qualification. The prepared workflow
additions and parallel package-runner edits remain Claude's.
