# Selected storage and checkpoint assertion reasons

2026-10-11 Toronto · builder-authored bounded review/checks, not independent
evidence. CLAIMS S147. Protected tests and product source remain unchanged.

Read all seven selected complete patches from S143's frozen named-test
inventory. Preserve before/after/diff hashes and current test hashes. Five edges
cover every modification of `storage-failures.test.ts` within that inventory;
two further edges cover checkpoint fixture changes. This does not review every
storage source, helper, historical test addition or other checkpoint assertion.

| Commit / test | Reason for the change |
|---|---|
| 2692542 / checkpoint state | Clone the shared policy before the intentional caller-mutation probe. Preserve the asynchronous capture equality assertion; add proof that the shared workload cap remains unchanged. This repairs cross-test pollution rather than removing the mutation scenario. `evals/sdk/policy-signature.md`. |
| 701372e / checkpoint owned recovery | Count and inject reads only on the checkpoint inode. The new raw journal reader otherwise triggers a global checkpoint fault at the wrong operation. Retain all short/growth/error/invalid-count cases, pre-read refusal and fallback assertions. `evals/sdk/record-read-completion.md`. |
| fba638a / storage failures | Add both ownership modes and append/truncate/overwrite damage on the held journal, including unchanged timestamp/changed-size evidence. Require permanent refusal, unchanged damaged bytes, no uncommitted cache entry and no revival after repair. Existing storage-failure checks remain. `evals/sdk/live-record.md`. |
| 67948e6 / storage failures | Add changes during actual startup reads; require refusal and confirmation that the injection occurred, then prove ownership is released for restored evidence. `evals/sdk/record-read-stability.md`. |
| 701372e / storage failures | Keep the startup physical mutation effective for either string or Buffer reads. Add short/oversized read refusal without losing acknowledged entries and positive torn UTF-8-tail recovery. `evals/sdk/record-read-completion.md`. |
| 3fe0f0d / storage failures | Add missing/extra physical append evidence faults before acknowledgement, permanent failure and evidence preservation. Add complete nonempty-journal success with hash equality. `evals/sdk/record-write-completion.md`. |
| 49f6d63 / storage failures | Add record/lock inode replacement during append. Require no acknowledgement/cache transition, retained original and moved evidence, and no repair/removal of another inode. Existing checks remain. `evals/sdk/record-write-identity.md`. |

Within these selected diffs, original checks remain or extend. The checkpoint
fixture corrections target the intended operation and preserve their refusal
population. This is scoped builder judgement, not independent approval or proof
of every historical gate. Earlier receipts retain their initial failures and
fault results; they are not relabelled as fresh current evidence.

```sh
uv run --script evals/release/assertion-storage.py
node --test packages/sdk/test/checkpoint-state.test.ts packages/sdk/test/checkpoint-owned-recovery.test.ts packages/sdk/test/storage-failures.test.ts
npm run typecheck
```

Preserve the output directory before regeneration. The collection is a data
reader, not a release gate. `focused-current.txt` records all 49 current focused
tests passing on Node 26.7.0, without failure, skip, cancellation or todo;
`typecheck.txt` exits successfully. Local temporary journals and synthetic keys
are fixtures; no actual key file, chain send or dedicated-user deployment occurs.
These checks do not establish power-loss durability, full native/hosted success,
bounded restart, independent review or stable qualification. H11, H15, broader
history review and every remaining release gate stay open.
