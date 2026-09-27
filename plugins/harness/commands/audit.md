---
description: Audit a repo's skills, agents, commands and hooks as a system — boundaries, retrieval, model pinning, exit conditions.
argument-hint: [path to .claude/ or a marketplace root; defaults to this repo]
---

Run `workflows/harness_audit.md` against: $ARGUMENTS

Start with the machine half, because arguing about what a script can decide is waste:

```
uv run --script tools/lint_plugins.py
uv run --script tools/scaffold.py --check
```

Then the four things a script cannot decide:

- **Boundaries.** For every agent claiming to review, audit or verify — can it edit what
  it finds? Read the frontmatter, not the prose. Then read the hooks, and specifically
  their *failure path*: a missing policy, an erroring script or a trailing `|| true` that
  lets the call through means the gate is decorative (`kb/GAPS.md` gap 8).
- **Retrieval.** Read only the descriptions, as a flat list. Which two collide on a real
  task?
- **Model pinning.** A dated id rots silently; no model field at all is the opposite
  failure.
- **Exit conditions.** `## When to stop and ask` is missing from 99.3% of the corpus.

**Report findings as specific edits with `path:line`, addressed to their owner. Make
none of them.** A seat that fixes what it finds stops being a gate.

Finish by stating what the audit could NOT check, and why. If everything passed, run it
against a deliberately broken copy before believing it.
