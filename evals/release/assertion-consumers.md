# Remaining packed-consumer assertion reasons

2026-10-11 Toronto · builder-authored historical review. CLAIMS S155.
Read every complete patch in this selection, including added cases, then bind
the exact parent/commit/path, before/after content and current test hashes.
The durable patch stream equals the scratch stream read in bounded chunks.
Protected tests and product remain unchanged.

| Commit | Reason and retained limitation |
|---|---|
| f16938c | Correct the offline cache preparation comment; no assertion changes. |
| f9c0cec | Add sending-client declarations, prohibited signing/telemetry examples and exact connection-failure/method checks. Existing SDK declaration cases remain. `evals/sdk/sending-client.md`. |
| f1b6010 | Add archive declarations and real-history/wrong-head checks. The typed head example is subsequently displaced, as recorded below. `evals/sdk/archive.md`. |
| 22235e7 | Add archive executable success/wrong-head checks and append its usage exit to the existing binary list. `evals/sdk/archive-cli.md`. |
| 00c42e8 | Add anchor option/result/type and API/CLI refusal checks, but replace the typed head example with anchor. This loses a declaration check: S154 proves the maintained miss and O10 remains unapplied. Runtime head refusal remains. `evals/sdk/archive-anchor.md`. |
| e508246 | Add canonical public policy preparation, unsigned result, unchanged source and help checks. `evals/sdk/prepare-policy.md`. |
| afa0b21 | Add both checkpoint signature domains, trust cluster typing, immutable binding and altered digest refusal. `evals/sdk/checkpoint.md`. |
| 40fa2fc | Add resealed malformed-controller replay/restore refusal, immutable catalogue declarations and missing-endpoint catalogue refusal. Earlier payment/drain/binding cases remain. `evals/sdk/malformed-replay.md`, `evals/sdk/checkpoint-archives.md`. |
| afe482a | Add compiled internal payload lifecycle, uncertain send, profile/digest/frozen facts and dishonest replay refusal outside the workspace. These internal modules are explicitly not stable root exports. `evals/packaging/checkpoint-payloads.md`. |
| 2692542 | Add bounded pre-decode policy signature refusals and single-read signature capture; restore Buffer instrumentation in finally. `evals/sdk/policy-signature.md`. |
| 6d81f8b | Add bundle consistency/binding verification and extend required compiled file membership, retaining prefix/state checks. `evals/sdk/checkpoint-bundle.md`. |
| 0c61fa3 | Add actual kernel-owned publication, predecessor retention and forged owner refusal; append publication files. `evals/sdk/checkpoint-publication.md`. |
| 995c5b0 | Add fresh Keel rebuild endpoint/events/next-tick agreement and altered prefix refusal. `evals/sdk/checkpoint-rebuild.md`. |
| f05c84d | Add authenticated recovery, corrupt fallback, re-signed dishonest state fallback and anchor disagreement refusal; append recovery files. `evals/sdk/checkpoint-recovery.md`. |
| 49f753b | Add owned recovery, forged/redirected owner refusal and unchanged corrupt checkpoint fallback. Fixtures restore the lock path. `evals/sdk/checkpoint-owned-recovery.md`. |
| c2c2f5c | Add exact streamed receipt/count/immutability, cancellation without receipt and wrong digest refusal. `evals/sdk/archive-stream.md`. |
| b352454 | Add streamed replay count, captured trust and changed second-pass source refusal. `evals/sdk/replay-stream.md`. |
| a4d1c25 | Replace the basic publication call with a captured-copy mutation test retaining the same publication assertions; append error artefacts and record-only import/capability refusal checks. `evals/ci/history-owned-publication.md`. |
| 39c24de | Add installed offline preview, impossible report/redemption refusal across replay/restore, complete request-index shards, lifecycle/absence/frozen facts, forged root and locally rechecksummed omission refusal. Append index to existing payload refusal/file lists. `evals/sdk/request-index.md`, `evals/sdk/report-replay.md`, `evals/sdk/redeem-replay.md`. |
| 43f20c0 | Add typed invalid container/field refusal across all client methods and zero socket dispatch; preserve the original connection/method assertions. `evals/sdk/sending-client-input.md`. |
| 5a33e69 | Add owned request-index publication, forged owner/corrupt pointer refusal without repair and predecessor retention. `evals/sdk/owned-request-index.md`. |
| 7118ae2 | Add current owned lookup, uncertain history and tail/absence binding plus forged owner/corrupt pointer refusal. `evals/sdk/request-index-lookup.md`. |
| 9996f00 | Add installed replay trust/source/size refusal, legacy compatibility and exact redacted divergence diagnostics. Uses synthetic keys and bounded child execution. `evals/sdk/replay-command.md`. |
| b1d8ed1 | Add private owned control capture, response immutability, idempotency, payload/owner/corruption/stale-lookup refusal and avoidance of replaced public bookkeeping. Extend cleanup around added gap cases; prior admission refusal remains. `evals/sdk/owned-control-request.md`. |
| 36a1ae7 | Add private facade nonexport, policy/version/lifetime/FIFO/capture and corrupt index refusal checks, with fixed child containment. `evals/sdk/owned-guard.md`. |
| 944579d | Add private facade reused identity/different bytes refusal. `evals/sdk/owned-admission-error.md`. |
| 7a64856 | Add signed release capture, malformed date and failed storage preservation; retain restored used-redemption refusal while extending its try body. `evals/sdk/owned-release.md`. |
| fba638a | Add both ownership modes' external append/truncate/overwrite refusal, unchanged damaged bytes and permanent failure after repair. `evals/sdk/live-record.md`. |
| 84cac38 | Add aliased journal/mutex refusal and failed-startup cleanup/evidence preservation. `evals/sdk/record-alias.md`. |
| 67948e6 | Add startup-read mutation and released ownership; later S145 reviews adaptation to the raw reader. `evals/sdk/record-read-stability.md`. |
| 3fe0f0d | Add missing/extra physical append refusal, permanent failure and positive complete appends. `evals/sdk/record-write-completion.md`. |
| 49f6d63 | Add post-write journal/mutex replacement refusal, no acknowledgement or revival and preservation of foreign evidence. `evals/sdk/record-write-identity.md`. |
| 4addaa4 | Add private report FIFO/durable clock/caller attribution, coercion refusal, write failure and restart checks across outcomes. Retain explicit fixture containment and earlier failure evidence. `evals/sdk/owned-report.md`. |

```sh
uv run --script evals/release/assertion-consumers.py
uv run --script evals/packaging/archive-head-declaration-run.py
```

Preserve existing output/scratch before regeneration. The second command is
S154's already-completed hash-bound reproduction, not a fresh repeat here.
Its five complete installed populations provide the current consumer context:
maintained actual archive passes nineteen; head omission also passes nineteen
(miss); anchor omission and proposed head omission each pass eighteen/fail one;
proposed actual archive passes nineteen. Raw outputs and declaration/file
bindings remain in that receipt. No new execution result is invented or pooled.

This closes builder reason allocation for the remaining thirty-three frozen
modification edges, not approval of every assertion or historical helper.
Initial test additions, later history, source rights, secret review, independent
evaluation and public-history clearance remain separate. O10 and H11 remain
open. Complete historical patches reveal no additional displaced assertion
within this selection beyond the confirmed head declaration gap; that is a
scoped builder judgement, not independent assurance or stable qualification.
