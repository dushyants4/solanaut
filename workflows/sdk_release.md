# workflows/sdk_release.md — prepare a release someone outside can consume

**T3 up to the tag. Anything public is T4 — the human's, every time.**

## Objective

Get a version to the point where publishing it is one command and no judgement.

## Inputs

- The change set since the last tag
- The public surface — what a consumer imports, not what happens to exist
- `sdk-surface-design`, from the `integrator` seat

## Steps

### 1. Decide what actually changed for a consumer

Read `git log` since the last tag, then set it aside and read the **diff of the public
surface**. Internals churning is not a release note. A signature change is one, even if
the commit called it a refactor.

### 2. Version by what breaks, not by how much work it was

A rename in the public surface is major however small the diff. A thousand-line internal
rewrite that changes nothing a consumer touches is a patch.

### 3. Run the gates on a machine that is not yours

```
uv run --script tools/session_close.py
```

Then let CI run them too. **`operator`'s question is whether it comes up clean somewhere
else**, and a green local run does not answer that.

### 4. Write the changelog for the consumer

What they must change, what they may now do, and what silently behaves differently. The
third is the one that gets omitted and the one that costs the most.

### 5. Scan the diff for anything key-shaped

```
git diff <last-tag>..HEAD | grep -inE 'api[_-]?key|secret|token|password|BEGIN [A-Z ]*PRIVATE KEY|sk-[a-zA-Z0-9]{16}'
```

Any hit stops the release. A secret in git history is not removed by the next commit.

### 6. Tag, then stop

Tag locally. **Prepare** the publish command and hand it over. Registry publish, public
merge and production deploy are T4: the human presses, every time. There is no standing
grant for those and there is not going to be one.

## Outputs

- A tag, and a changelog written for a consumer rather than for the author
- The exact publish command, prepared and not run
- A `runs/` record naming what was deliberately left unpublished

## Edge cases

- **The public surface is undocumented.** Then it is not a public surface, it is an
  accident. Document it or narrow it before tagging.
- **A dependency changed its own major version.** That is consumer-visible even if none of
  your code moved.
- **CI is red for an unrelated reason.** Do not tag through it. Record it and stop.

## When to stop and ask

- Always, before anything reaches a registry or a public branch.
- The version number is arguable. An arguable major is a major — but say that it was
  arguable.
- A gate fails and the only route past it is to weaken the gate.
