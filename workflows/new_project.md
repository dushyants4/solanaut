# workflows/new_project.md — point the Office at a codebase it has never seen

**Run after `triage.md` has said this is Office's work and the target is unfamiliar.**

## Objective

Reach the point where a design decision can be made on evidence rather than on a guess
about how the codebase works — and record what was measured, so the next session does
not re-derive it.

## Inputs

- The target repo, and written confirmation it is in `CLAUDE.md`'s "Repos I write to"
- The request that arrived
- `kb/REGISTRY.md` — what Office points at rather than re-authors

## Steps

### 1. Establish the write boundary BEFORE reading the code

An unlisted repo is read-only. If the target is not in the project-context block, the
work that happens now is T0 — reading and reporting — and the block gets updated by the
human before anything is written. Do not discover this halfway through an edit.

### 2. Read before writing

`git log --oneline -30`, the README, the test command, the CI config. Then the entry
point. **If you cannot explain why the code is written the way it is, you are not ready
to change it** — say so and keep reading.

### 3. Measure, do not assume

Record, with the command that produced each:

| Question | How |
|---|---|
| How is it tested, and does the suite pass *now*? | run it, before touching anything |
| How long does the suite take? | time it — this decides whether TDD is viable |
| What is the dependency surface? | the lockfile, not the README |
| Is there existing `.claude/` tooling? | `harness_audit.md` |

**A suite you have not seen pass is not a baseline.** If it is already red, that is the
first finding and it changes the whole plan.

### 4. Decide the topology, then write it down

`agent-topology-design` and `context-budget`, from the `architect` seat. The output is an
ADR in `design/`, not a directory of agents. **The design changes first, the harness
second, the code third.**

### 5. Write the failing eval

`eval-first`. Before implementation, not after. A test written after the code passes is a
description of the code, not a check on it.

## Outputs

- An ADR in `design/` carrying the topology and the evidence for it
- A baseline: suite state, timing, dependency surface, each with its command
- At least one eval that currently fails, for the right reason
- A `runs/` record; `PROGRESS.md` updated

## Edge cases

- **The suite is already red.** Report it. Do not fix it silently, and do not build on it.
- **No tests at all.** That is the finding. The first deliverable becomes a
  characterisation test, and the ADR says so.
- **The repo is enormous.** Budget the context deliberately (`context-budget`) and record
  what you chose to leave out. An unstated omission reads as a claim of coverage.
- **The target is not in the write list.** T0 only. Say it in the first reply, not the
  last.

## When to stop and ask

- The request needs a write to a repo that is not listed.
- The baseline contradicts the request — you were asked to extend something that does not
  currently work.
- Two topologies are genuinely defensible and the choice is about cost rather than
  correctness. That is the human's call, not yours.
