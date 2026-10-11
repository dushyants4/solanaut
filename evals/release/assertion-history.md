# Assertion-review preparation — bounded test history

2026-10-11 Toronto · builder-authored PUB-1/handoff preparation, not independent
review. Frozen Beta e925f1d to 753769d. CLAIMS S143. No protected gate changes.

## Scope

The handoff asks for changed/removed test assertions and reasons. A net diff
alone cannot expose intermediate changes to tests added after Beta. Inventory
every parent edge of every post-Beta ancestor commit, with renames represented
as deletion/addition. Require externally exact commit pins and ancestry. Disable
Git replacement objects. Read only metadata for named `.test.ts`, `.test.mjs`
and `.test.js` files under SDK/app test roots and evals; unknown test roots and
nonregular Git objects refuse rather than silently disappear.

The inventory reads no file-blob contents and explicitly reports review and
public-history clearance false. These paths are a bounded review aid, not all
executable batteries, helpers, Python/Rust tests or the entire proposed public
history. H15 remains pending; no confidential/key/drop contents are consulted.
The separate net-delta review below reads only the named ordinary durable test.

## First failures and faults

Initially five of six cases fail without an implementation. The invalid-pin
negative case passes vacuously when the helper is absent. Preserve that finding;
add its positive empty-range control before implementation. All six then fail
against the missing helper. Both raw initial outputs remain.

After implementation, all six synthetic cases pass. They cover intermediate
edits, deletion/rename, branch/merge edges, exact pins/missing objects/unrelated
ancestry, unsupported test roots and symlink refusal. Seven isolated copied-source
faults each complete the entire six-case population and exit one: omit modified
files, enumerate first parents only, omit deletions, ignore scope refusal, omit
object-mode checks, omit exact-pin checks, and fabricate assertion-review clearance.
Restore/remove the candidate; original bound helper/test/runner bytes never change.
Final Node 26.7.0 and 24.19.0 controls pass. Typecheck passes.

## Actual inventory and net review

The exact frozen range contains 138 commits. Its named-test parent edges are
103 additions and 142 modifications, with no deletion/type-change edge. The
modifications concern 30 distinct paths. `actual.json` binds each edge to its
parent, commit and path, with reason review still pending. Counts are edges,
not independent findings, distinct tests, assertion edits or audited changes.

The net diff of modified/deleted tests already present at Beta contains only
`packages/sdk/test/durable.test.ts`; complete diff is retained. Review reason:

| Changed assertion/behaviour | Reason and evidence |
|---|---|
| Implicit successful takeover of a dead process's SDK lock becomes an explicit `/locked/` refusal | Accepted ADR-019 removes the non-atomic stale-lock takeover race. SDK mode must refuse stale ownership. Existing live-second-writer refusal remains. |
| Positive recovery now explicitly uses `fileStore(path, { ownership: "kernel" })` | Preserve the recovery check through the supported exclusive mechanism. `evals/sdk/ownership.md` records this change and its first failures/fault evidence, CLAIMS S16. |

The test title/import changes match those semantics. This is the builder's review
of that net delta; it does not clear the 142 historical modification edges or
tests whose changed helpers could alter assertions indirectly. Claude's separate
review and reasons for historical changes remain owed. No assertion is edited here.

## Regeneration and evidence

```sh
python evals/release/assertion-history.py --baseline e925f1dfaabc7eedae361764a401baf7f9e9868b --head 753769dcd435b9334e59e921727c04afd6cb6859
node --test evals/release/assertion-history.test.mjs
npm run typecheck
```

`uv run --script evals/release/assertion-history-run.py` freezes and regenerates
the full campaign at that exact head. For its combined campaign, restore the
frozen head in a fresh local checkout and copy the three hash-bound evaluator
files into it; preserve prior output before running. The standalone inventory
command above can regenerate that frozen range from a later checkout.
Definition/input hashes, all faults/controls, actual metadata and separate net
diff are retained. Owned job/completion is under `.sandbox/assertion-history/`.

No product fix, independent security review, full native/hosted pass, history
publication clearance or stable milestone follows. H11 remains failed and
pending architecture/external gates remain required.
