# Remaining small assertion modification reasons

2026-10-11 Toronto · builder-authored scoped review/checks. CLAIMS S153.
Protected tests and product unchanged. Bind fifteen exact patches from S150's
frozen pending list, excluding the separately reviewed coverage/staging files
and the remaining packed-consumer edits. Read every selected complete patch.

| Commit / test | Reason |
|---|---|
| 033cd87 / durable | Replace unsafe dead-PID takeover with explicit SDK refusal and positive kernel recovery, retaining second-live-writer refusal. Accepted ADR-019 and `evals/sdk/ownership.md`; S143's earlier net reason remains. |
| f6c8641 / signing history | Add final-outcome signing/send-intent refusal live and on replay, with unchanged history on refusal; unknown outcome retains the permitted lifecycle. `evals/signer/policy-recovery.md`. |
| f631671 / properties | Add asynchronous under-budget/failing-property refusal and exact completed-run count alongside existing synchronous controls. `evals/ci/properties.md`. |
| 657e338 / signed policy | Add missing/non-text authorization and noncanonical recorded-policy refusal; retain previous cases. `evals/ci/coverage.md`. |
| 00c42e8 / archive CLI | Add anchor-bound success/refusal and malformed/duplicate flag checks while preserving source bytes and earlier command tests. `evals/sdk/archive-anchor.md`. |
| ddc8bb0 / supervisor | Add captured environment/loader refusal and TERM/KILL eligibility checks. KILL still requires explicit fixture child containment; no automatic recovery is claimed. `evals/ci/run-environment.md`. |
| 805e8bb / checkpoint | Add equivalent-byte noncanonical signature refusal and pre-decode length checks in both signature domains. Prior malformed-signature checks remain. `evals/sdk/checkpoint-signature.md`. |
| afed152 / mutation report | Test invalid status at both surviving/killed positions so a score deficit cannot mask ignored invalid evidence. Add separate retained/new-population floors, with the prior threshold unchanged. `evals/ci/mutation-authentication.md`. |
| 2692542 / signed policy | Add fixed typed refusal before invalid-length base64 allocation and single-read signature capture. Existing authorization cases remain. `evals/sdk/policy-signature.md`. |
| 995c5b0 / checkpoint prefix | Add fresh Keel rebuild agreement, event/scope/capture refusal and deliberately divergent controller refusal; earlier prefix checks remain. `evals/sdk/checkpoint-rebuild.md`. |
| a4d1c25 / publication | Add captured publication limits/trust/archive pins across asynchronous loading; mutation cannot promote an initially invalid limit or change written evidence. `evals/ci/history-owned-publication.md`. |
| 5b00257 / fingerprint | Create the required workflow directory in the older synthetic operator-tool fixture after workflow fingerprint coverage expands. Keep the original changed-tool fingerprint assertions. `evals/ci/bite-partitions.md`. |
| 5a33e69 / publication | Add cache mutation during validation with unchanged journal/prior checkpoint on refusal and fixture restoration. `evals/sdk/request-index-publication.md`. |
| 588a1ef / mutation stop | Add missing committed result/marker refusal without signalling a potentially reused PID; restore the evidence and retain earlier malformed-completion checks. `evals/ci/run-completion.md`. |
| 84cac38 / ownership | Add hardlinked journal/mutex alias refusal, retained evidence and reopened ownership after removing aliases. Earlier exclusive-owner cases remain. `evals/sdk/record-alias.md`. |

Within this selection, replacements have explicit safety/fixture reasons and
earlier checks remain. Initial historical failures, missed faults, interruptions
and receipt limitations are not replaced by this judgement or current passes.
The supervisor's observed surviving child after KILL is a containment limitation,
not evidence of automatic cleanup. This does not review every supporting helper,
test addition, public-history content or historical packed-consumer assertion.

```sh
uv run --script evals/release/assertion-other.py
node --test packages/sdk/test/durable.test.ts packages/sdk/test/signing-history.test.ts packages/sdk/test/signed-policy.test.ts packages/sdk/test/archive-cli.test.ts packages/sdk/test/checkpoint.test.ts packages/sdk/test/checkpoint-prefix.test.ts packages/sdk/test/checkpoint-publication.test.ts packages/sdk/test/ownership.test.ts evals/ci/properties.test.ts evals/ci/run-supervisor.test.ts evals/ci/mutation.test.ts evals/ci/bite-source.test.ts evals/ci/mutation-stop.test.ts
```

Preserve the collection directory before regeneration. Current Node 26.7.0
checks pass all 151 cases without failure, skip, cancellation or todo; raw output
remains. Temporary files, synthetic in-memory signatures and owned child processes
are fixtures; no actual key file, chain send or dedicated-user isolation occurs.
This is neither a full selected mutation baseline nor a completed score/native
gate. No TS changes follow S149's successful typecheck. S150's earlier frozen
map does not yet index this receipt. All independent/public-history/release
clearance flags remain false; H11 and stable qualification remain open.
