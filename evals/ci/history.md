# PUB-1 — original-repository history inventory preparation

2026-10-06 · evaluator/operator · builder-authored local Linux evidence, Node 26.7.0.
This qualifies the inventory component. It is not the confidentiality, secrets, source-rights,
licence or final publication review, and does not change visibility or rewrite any history.

## Scope and evidence

The inspector captures current HEAD and every local ref, peels commit references, walks their
complete parent closure and enumerates each commit's NUL-framed tree. Historical blobs retain
all observed paths and modes, including deleted/renamed files and symlinks. Gitlinks remain
explicit; their target repositories are not traversed. Blob identity/size is Git metadata;
contents are not scanned for secrets or assessed for rights. The manifest has a deterministic
digest. Shallow repositories, unsupported/non-commit refs, missing metadata, incomplete
closure and changed refs/HEAD refuse. Process reads have fixed resource bounds.

The local checkout has harness tree refs, so the first actual run refuses; retained in
`history/inventory-summary.txt`. It does not silently omit them. A fresh private mirror of
the original origin supplies the server's advertised ref set. No harness ref is modified,
and no drop or historical blob is changed. That mirror at
`0978aaa8dbb30d3ae8a0e8db17e4c2c3cb1fe523` inventories five refs, 83 commits, 1,607 blobs,
848 distinct paths and no gitlinks. The exact ref names/object identities are in
`history/inventory-0978aaa-1493400ae7fd-1791335294123.json`; digest
`1493400ae7fd0979deeb5a2d94354d6583e43d98fc37dcaf789ca38a1693f1e6`.
Raw summary: `history/origin-summary.txt`. It is the inspected mirror's scope, not all
local harness objects or a decision about the human's final proposed publication scope.

Reflogs/unreachable objects, uncommitted work and gitlink target repositories are excluded
explicitly. Final review must settle the publication ref set, hosted historical exposure,
confidential material, source rights, third-party notices and secret findings before visibility
changes. Freeze the candidate and regenerate its inventory; this earlier manifest cannot
clear a later revision. Human-owned licence/publication decisions remain required.

## Failures and maintained regressions

All eight initial cases fail against the stub (`initial-red.txt`). The first implementation
passes them but does not check every ref target belongs to the returned closure; the added
case fails (`closure-red.txt`), then the ref-target check corrects it. Twelve component cases
pass, including SHA-1/SHA-256 Git, deleted/changed content, divergent branches/tags, detached
HEAD, unusual paths, modes/gitlinks, shared blobs and malformed metadata (`restored.txt`).

The first detached-HEAD planted edit removes a redundant explicit argument, so no case fails
(`faults.txt`). Git's [official rev-list documentation](https://git-scm.com/docs/git-rev-list)
states that `--all` already includes HEAD. Record this equivalent edit, then replace it with
the genuine branch/tag-only omission; do not assert an argument spelling as correctness.
Eleven real faults are caught (`faults-final.txt`), and restored cases pass. Removing full
history, detached HEAD, shallow refusal, ref closure, tree framing, blob validation, stable
scope, shared paths/modes, gitlinks or the derived digest is caught.

Two further cases demonstrate real read-only/history gaps (`readonly-red.txt`): a local
graft hides the original parent, and a partial clone lazily fetches missing blobs. Git's
[repository-layout documentation](https://git-scm.com/docs/gitrepository-layout) explains
synthetic graft ancestry; its [environment documentation](https://git-scm.com/docs/git/2.53.0.html)
documents disabling lazy fetch. Per-process settings ignore grafts and disable lazy fetching
and optional locks, without changing any configuration or repository. Fourteen final cases
pass (`readonly-final.txt`), including refusal with unchanged partial-clone object inventory.
Thirteen real faults now pass with restoration (`faults-readonly-final.txt`), including
deleting either new protection. The earlier outputs remain unchanged. An additional real
commit-graph fixture already refuses a missing historical commit; no production fix is
needed (`commit-graph-probe.txt`). Fifteen final cases and the thirteen-fault campaign are
retained in `commit-graph-final.txt` / `faults-commit-graph-final.txt`.

The existing campaign inventory rejects the new unregistered fault file (`inventory-red.txt`).
Register it, then all three aggregation cases pass (`inventory-final.txt`). Typecheck passes
(`typecheck.txt`). Full root/aggregate close and hosted CI remain pending; do not infer them
from this component receipt. The ongoing frozen Stryker run's SDK source/dependencies are
unchanged; only the new inventory checker is fault-injected in this step.

## Regenerate

- `node --test evals/ci/history.test.ts`: fifteen cases.
- `node evals/ci/history-faults.ts`: thirteen faults and restoration.
- `node --test evals/ci/bite.test.ts`; `npm run typecheck`.
- Create a fresh private mirror with
  `git clone --mirror --no-hardlinks https://github.com/dushyants4/solanaut.git .sandbox/solanaut-1/history-origin.git`, then
  `node evals/ci/history-run.ts --repository .sandbox/solanaut-1/history-origin.git`.
  The command records the actual ref set and revision. The retained snapshot above uses
  its named historical input; updating the mirror is a new measurement, not the old result.

No source content, key value or credential is emitted by the inspector. It supplies a
review inventory, not a secret scanner or release-authorisation gate.
