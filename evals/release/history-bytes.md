# PUB-1 companion — read-only historical blob verification

2026-10-10 Toronto · builder-authored local Linux evidence.
Reviewed product checkpoint be7d29694f13418f1ff0a48b0b6a5721e08797c4.
This is independent publication-review preparation under the approved mission;
it changes no product, protected inventory gate, public API or visibility.

The existing inventory verifies commit bodies and enumerates blob metadata.
The companion first requires that exact complete inventory to match the current
repository. It refuses gitlinks and sensitive path classifications before file
blob reads. Otherwise it reads each blob as bytes, checks its length and Git
object hash, records its SHA-256, and rechecks the complete scope. Nothing is
silently skipped. Per-object reads have a fixed resource limit; exceeding it
refuses the whole receipt. Sources and runtime are pinned in the CLI evidence.

The initial stub fails seven of eight cases; the existing pure path classifier
control passes. The first implementation passes eight, then eleven expanded
cases. An injected size-check omission initially survives because hash checking
also rejects truncated data. Preserve that miss; the strengthened boundary
regression requires the actionable size diagnosis. SHA-256 success also explicitly
asserts that verification does not throw. No acceptance criterion is weakened.
CLI success/refusal cases expand the final population to thirteen.

All thirteen final cases pass on Node 26.7.0 and the already installed Node
24.19.0. Nine final omissions are caught with complete thirteen-case runs,
no skipped/cancelled/todo credit and exact restoration: inventory, size, hash,
scope, sensitive-path preflight, gitlink preflight, Git object format, durable
CLI refusal and clearance flag. Original eleven-case trials, the size miss and
all earlier outputs remain separately retained. Synthetic Git fixtures include
historical text, raw binary and SHA-256 objects. Sensitive metadata fixtures
only reference existing synthetic text in an index; no private/key file is
created or read, and their preflight verifies zero blob-reader calls.

## Actual history refused

The exact clean local bundle restore at be7d296 contains 6,254 distinct reachable
historical file blobs. Its inventory has one path classified by a private
directory component, so the real companion refuses before any file-blob
contents are read. This is a conservative path classification, **not a secret
finding or a determination that its contents are confidential**. No path names
or private contents are quoted here. Human settlement of the proposed public
scope and confidential review remain owed as H15; no entry is skipped or removed.

Inventory digest:
`4e631f23ec258f7701a3b8c606b6624fad24bfb8408c9eca90b8d35e907938c1`.
The complete metadata inventory, source/runtime pins and explicit non-completion
are retained under history-bytes/refused-final. The initial CLI loses structured
evidence on refusal; preserve its raw output and exact original runner, then
retain inventory/inputs/refusal before returning nonzero. The final CLI tests
prove that a refusal never creates a completed content receipt. Commit/tree
metadata is read by the inventory; the contentRead flag refers to file blobs.

The mandatory full native baseline passes 900 of 901 and fails only H11's
unchanged staged wait; typecheck passes. The thirteen nested component tests
are separate from the root suite. O8 is an exact unapplied CI draft for those
tests/faults, preserving the existing runtime matrix, steps and limits. Its
read-only patch check passes; owner application and hosted qualification are
owed. Merge additively with other owed runtime-step drafts, rather than replace
their campaigns. No complete CI, public-history clearance or stable milestone
is inferred.

```bash
node --test evals/release/history-bytes.test.mjs
uv run --script evals/release/history-bytes/faults.py
mise exec node@24.19.0 -- node --test evals/release/history-bytes.test.mjs
node evals/release/history-bytes-run.mjs .sandbox/local-backups/restore-batch-candidate <fresh-workspace-output-directory>
git apply --check evals/release/history-bytes/owner-ci.patch
npm test
npm run typecheck
```

Archive previous trial outputs before regeneration. Runtime installation is
not authorised; the Node 24 command requires that existing runtime. Never use
this companion to read a key or private file against repository instructions.
Human drop bytes, original refs, repository visibility and history are unchanged.
Future revisions/ref sets need their own inventory and review. Reflogs,
unreachable objects, uncommitted files and gitlink targets are outside the
inventory's stated scope; the human's final public scope is not settled.
