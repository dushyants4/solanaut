---
name: context-budget
description: Use when deciding what belongs in the context window and what belongs on disk — designing an agent's memory, diagnosing an agent that forgets or contradicts itself, or planning work that outlives a single session. Invoke before long-horizon tasks and whenever "just add it to CLAUDE.md" is proposed as the fix.
---

# Context budget

Deciding what the model holds and what the filesystem holds.

Answers `kb/GAPS.md` gap 3. The largest library in the surveyed corpus ships 926 skills
into one context, and nobody reports a retrieval hit rate. Context is a budget whether or
not it is treated as one.

## When to use

- Designing an agent that runs longer than one session.
- An agent forgets earlier decisions or contradicts itself.
- Someone proposes adding more to an always-loaded file.
- A skill library is growing and retrieval is getting worse.

**When not to use.** Not for short single-shot tasks that fit comfortably. Budgeting
something that is not scarce is overhead.

## Process

### 1. Classify every candidate

| Tier | What | Where it lives | Cost |
|---|---|---|---|
| **Always** | facts true every session, needed every session | `CLAUDE.md` | paid every turn |
| **On trigger** | needed when a condition holds | a skill's description → body | paid on match |
| **On demand** | needed only when the body says so | `references/`, read by path | paid when read |
| **On disk** | state that must survive context loss | `runs/`, plan files | paid only on re-read |

**Default to the lowest tier that works.** Promotion needs a reason; demotion does not.

### 2. Protect the always-loaded tier hardest

Every line in `CLAUDE.md` is paid for on every turn of every session forever. Ask of each:
*is this true every session, and needed every session?* Most "useful context" is only the
first.

**A wrong fact here is the most expensive defect in a harness**, because everything
downstream inherits it with full confidence.

### 3. Make triggers discriminating

The description decides whether a body is ever loaded. Two skills whose descriptions both
plausibly match the same request means neither is reliably retrieved. Corpus median
description is 150 characters — long enough to state a condition, too short to summarise.

Write *when to use*, and also *when not to*. The negative half is what stops collisions.

### 4. Put durable state on disk, not in the window

Context dies: it fills, it compacts, the session ends. Anything that must survive belongs
in a file, and the file must be re-readable without the conversation that produced it.

The convention this office already uses:

| File | Holds |
|---|---|
| `runs/YYYY-MM-DD-<slug>.md` | what was asked, done, changed, found, still open |
| `README.md` leg table | phase and state, at a glance |
| `design/ADR-*.md` | decisions and why, so they are not re-litigated |

Write to them **as you go**, not at the end. A record written after context loss is
written from a summary, and the detail was the point.

### 5. Budget subagent context deliberately

Each subagent starts cold and re-derives its context from zero. That is the cost of the
boundary. If two agents need the same large context, they are one agent — see
`agent-topology-design`.

### 6. Re-read rather than remember

For long tasks, re-read the plan file at each phase instead of trusting the window to
still hold it. Cheap, and it fails loudly (file missing) rather than quietly (fact
forgotten).

## Red flags

- `CLAUDE.md` is growing every session and nothing is ever removed.
- An agent restates a decision it already made, differently.
- Two skills' descriptions overlap and you cannot say which should fire.
- Durable state exists only in the conversation.
- "Just add it to the context" is the standing answer to every quality problem.

## Rationalizations, and the rebuttals

- *"Context windows are huge now."* And retrieval degrades across them well before they
  fill. Size is not the constraint; attention is.
- *"It's only a few more lines in CLAUDE.md."* Multiplied by every turn of every session
  from now on. The always-tier is the one place where "only a few lines" is false.
- *"The model will remember."* It will not, and the failure mode is confident
  contradiction rather than an error.
- *"Writing it to a file is extra work."* It is the work. The alternative is doing the
  session twice.

## Verification

- Every candidate assigned a tier, with a reason for anything in Always.
- No two skill descriptions plausibly match the same request.
- Durable state written to disk during the work, not after.
- The plan file is re-readable by an agent with no prior context — check by reading it
  cold.

## When to stop and ask

- Something must be always-loaded but contains a secret or personal data.
- The budget cannot be met without dropping something the user asked for.
