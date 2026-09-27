# workflows/harness_audit.md — review a repo's agent assets as a system

**The `harness` seat's core job.** Also what Office runs on itself, through
`tools/lint_plugins.py`.

## Objective

Decide whether a set of skills, agents, commands and hooks will actually work together —
as opposed to whether each one reads well on its own.

## Inputs

- The target's `.claude/`, `plugins/`, or marketplace root
- `kb/GAPS.md` — the nine measured gaps this audit checks against
- `tools/lint_plugins.py`, for everything a script can decide

## Steps

### 1. Run the machine half first

```
uv run --script tools/lint_plugins.py
uv run --script tools/scaffold.py --check
```

Ten checks, each traced to a gap. Spend human judgement only on what those cannot decide.

### 2. Boundaries — is any of it enforced?

For every agent that claims to review, audit, analyse or verify: **can it edit what it
finds?** Check the frontmatter, not the prose. Measured across 31 repos, 0 of 1,435 agents
declared `disallowedTools` — assume the answer is no until the frontmatter says otherwise.

Then check the hooks. A `PreToolUse` hook is the only place a boundary becomes real.
**Read its failure path.** If a missing policy file, an erroring script, or a trailing
`|| true` lets the call through, the gate is decorative — `kb/GAPS.md` gap 8.

### 3. Retrieval — can the right thing be found?

Progressive disclosure loads name and description first. Read only the descriptions, as a
flat list, and ask: given a real task, which two collide? At 900 skills nobody in the
corpus reports a hit rate. If the set is large and unmeasured, that is the finding.

### 4. Model declarations

A dated model id rots silently — it keeps resolving to something, just not to what anyone
chose. No model field at all is the opposite failure: architecture work and a changelog
get the same budget.

### 5. Exit conditions

`## When to stop and ask` appears in 0.7% of the corpus. Its absence is the most uniform
defect there is, and it is what lets an out-of-scope agent produce a confident wrong
answer.

### 6. Report as edits, never as fixes

The audit produces specific changes with file and line, addressed to whoever owns them.
**A seat that can fix what it finds will eventually fix rather than report, and the gate
stops being a gate.**

## Outputs

- Findings ranked by cost of being wrong, each citing `path:line`
- Explicitly: what this audit could NOT check, and why
- No edits to the audited assets

## Edge cases

- **Everything passes.** Check the checker. A clean audit over a large asset set is more
  likely a blind check than a clean repo — run it against a deliberately broken copy and
  confirm it goes red.
- **Assets span several harnesses** (`.claude/`, `.cursor/`, `.codex/`). Audit the source
  of truth, then confirm the adapters are generated rather than hand-maintained.
- **No frontmatter anywhere.** Then these are documents, not components. Say so.

## When to stop and ask

- The audit implies deleting something someone depends on.
- A boundary is missing, and adding it would break a workflow currently in use.
- You cannot tell whether a component is live or abandoned.
