---
name: harness-audit
description: Use to review a repository's agent environment as a system — its CLAUDE.md, skills, subagents, commands, hooks and MCP wiring — and report what is unenforced, unfindable or stale. Invoke when inheriting a repo with existing .claude/ assets, when an agent keeps making the same mistake, or before adopting a third-party skill library.
---

# Harness audit

Reviewing an agent's environment the way you would review code.

Answers `kb/GAPS.md` gap 1. Measured across 31 repos and 1,435 agents: **none enforced a
write boundary**, 0.7% of components stated an exit condition, and 74% declared no model.
Boundaries were described everywhere and enforced nowhere.

## When to use

- Inheriting a repo that already has `.claude/` assets.
- An agent repeatedly makes the same mistake.
- Before adopting a third-party skill library.
- Periodically, on your own harness, because staleness is silent.

**When not to use.** Not for reviewing product code — that is `code-review`. This audits
the environment, not the output.

## Process

### 1. Inventory before judging

List every skill, agent, command, hook and MCP server, with its frontmatter. Count them.
You cannot review what you have not enumerated, and repos organised by domain rather than
component type hide their inventory from a casual look.

### 2. Boundaries: enforced or merely described?

For every agent that is *described* as read-only, reviewing, auditing or advisory, check
whether it actually is:

- Does it declare `disallowedTools`?
- If it declares `tools`, does that list exclude `Write` and `Edit`?

**A boundary an agent can cross is a preference.** Report each described-but-unenforced
boundary as a finding with the exact frontmatter line that would fix it.

### 3. Descriptions: triggers or summaries?

The description is the retrieval key — the only text loaded before the decision to load
the body. Flag every description that says *what this does* rather than *when to use it*.
A good skill with a summary description is an unreachable skill.

### 4. Models: absent, aliased, or rotting?

- A **dated model id** (`claude-*-20250514`) is a time bomb that fails quietly: it keeps
  resolving to something, just not what anyone chose. Flag every one.
- **No model at all** is the opposite failure: architecture work and a changelog get the
  same budget.
- Family aliases or `inherit` are correct.

### 5. Prose doing a script's job

Find instructions that describe a deterministic check in words. Each is a script and a
hook waiting to be written, and prose is the least reliable form it can take.

### 6. Exit conditions

Every skill is written for the case where it applies. Flag every one that never says when
it does not. An agent that cannot recognise it is out of scope answers confidently
outside it.

### 7. Staleness

Does `CLAUDE.md` describe paths, tools or rules that no longer hold? A confidently wrong
fact in the always-loaded file is the most expensive defect in a harness, because
everything downstream inherits it.

## Red flags

- A "reviewer" or "auditor" agent with unrestricted tools.
- Two skills whose descriptions would both match the same request.
- A `CLAUDE.md` naming a script, path or flag that does not exist.
- Hooks that fire on every tool call and do something slow.
- A skill with no failure mode described anywhere in it.

## Rationalizations, and the rebuttals

- *"The prompt tells it not to edit."* So does every reviewer agent in the surveyed
  corpus, and none of them is prevented from editing. Instructions are advisory;
  frontmatter is not.
- *"Descriptions are just documentation."* They are the retrieval key. This is the single
  highest-leverage line in a skill file.
- *"Pinning an exact model is more reproducible."* It is more reproducible right up until
  the id is retired, and then it is silently something else.
- *"We'd have noticed if CLAUDE.md were wrong."* A sibling office lost its charter and did
  not notice it was gitignored until the disk failed.

## Verification

- Every component enumerated with its frontmatter.
- Every described boundary checked against actual permissions.
- Every description classified trigger vs summary.
- Every model field classified aliased / dated / absent.
- Findings written as exact edits, for the owning seat to apply.

## When to stop and ask

- The fix requires editing a `CLAUDE.md` outside your write boundary — state the edit,
  hand it over.
- A hook would need to run something destructive or outbound.
- The audit implies removing a component someone else depends on.
