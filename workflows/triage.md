# workflows/triage.md — route an incoming request

**The entry point.** Run this first on anything that arrives without an obvious home.

## Objective

Get a request to the right seat, at the right tier, with the right workflow — or out of
this folder entirely.

## Inputs

- The request, in the requester's own words
- `CLAUDE.md` — the seat table and the instrument tiers
- `README.md` — what is currently in flight

## Steps

### 1. Is this Solanaut's work at all?

Solanaut builds one product and its demo. Route out anything that is not:

| If it is about | It belongs to |
|---|---|
| the legal entity, equity, funding terms, licensing | **the human** |
| posting, submitting, making anything public, mainnet, real funds | **the human (T4)** |
| anything inside the Gubernaut workspace, or a change to a Gubernaut package | **the human**, as a written finding |
| code, tests, docs, the sandbox, the demo, CI, releases prepared but not published | **Solanaut** |

Routing out is a complete answer. Say whose it is and why, and stop.

### 2. Name the tier before doing anything

| Tier | What moves | Needs |
|---|---|---|
| T0 | nothing — reading, answering | nothing |
| T1 | docs, drafts, `kb/`, `runs/` | the seat's own workflow |
| T2 | product code in a named target repo | evals green, diff reviewed |
| T3 | public API, SDK surface, gate scripts | **the gate shown failing first** |
| T4 | publish, deploy, public merge | **the human, explicitly, every time** |

**A request that implies T4 stops here** and becomes a prepared command handed over. If
the tier is above T1 and the user has not said so, ask before starting.

### 3. Name the seat

Match on the *question being asked*, not the subject matter:

| The question | Seat |
|---|---|
| What shape should this be? | `architect` |
| Why does the agent keep getting this wrong? | `harness` |
| Make it work | `builder` |
| Can someone outside use this? | `integrator` |
| Does it actually pass? | `evaluator` |
| Will it run somewhere else? | `operator` |
| What happened, what is owed? | `archivist` |

If two seats both fit, the work has two phases — run them in seat order, not at once.

### 4. Check the target repo is writable

`CLAUDE.md`'s project-context block lists the repos Office may write to. **An unlisted
repo is read-only.** If the work needs a repo not listed, add it to the block first, with
the user's confirmation — do not write to it and add the line afterwards.

### 5. Check for an existing workflow

`workflows/` first, then `kb/REGISTRY.md` for a third-party component that already covers
it. **Do not author what already exists** — ADR-001 §6.

If you are doing something for the second time and there is no workflow, write one.

### 6. Check for prior art in this office

`runs/` for whether this was attempted before, and `design/` for whether the decision was
already made. Re-litigating a settled ADR is a defect.

## Outputs

One line, before the work starts:

```
seat: <seat> | tier: T<n> | workflow: <file or "none, ad hoc"> | target: <repo or Office>
```

## Edge cases

- **Request spans Solanaut and something outside it.** Do Solanaut's half, state the other
  half explicitly for the human, and name who owns it. Do not do it yourself.
- **Request is urgent and implies T4.** Urgency does not move T4. Prepare the command.
- **Request contradicts an accepted ADR.** That is a finding for `architect`, not a reason
  to proceed quietly.
- **No seat fits.** That is a real answer — say so rather than forcing one.

## When to stop and ask

- The tier is T3 or T4 and the instruction was not explicit.
- The target repo is not in the project-context block.
- Two readings of the request lead to materially different work.
