---
name: agent-topology-design
description: Use when deciding how many agents a system needs and how they relate — single agent, orchestrator with subagents, sequential handoff, or a deterministic pipeline. Invoke before building any multi-agent system, when an existing agent is running out of context, or when someone proposes "let's add another agent" as the fix for a quality problem.
---

# Agent topology design

Choosing the shape before writing the system. Answers `kb/GAPS.md` gap 7: every category
scheme in the surveyed corpus indexes domain **or** lifecycle, never how the pieces
actually connect.

## When to use

- A new agent system is being designed.
- An agent is running out of context on real tasks.
- Someone proposes adding an agent to fix a quality problem.
- A multi-agent system is producing inconsistent results and nobody knows which stage.

**When not to use.** Do not use this to justify a topology already built — that is a
review, and it belongs to `evaluator`. Do not use it for a single deterministic task; see
step 1.

## Process

### 1. Ask whether it needs a model at all

**The arithmetic.** Five chained steps at 90% accuracy each is 59%. Every step moved into
a deterministic script stops multiplying against you.

For each box in your proposed diagram: *does this need judgement, or does it just need
doing?* Anything that just needs doing is a script. This step removes more boxes than any
other and it is the one most often skipped.

### 2. Start at one agent and justify every addition

One agent is the default. Each additional agent must name the specific thing it makes
possible, and the cost it adds. Every boundary between agents is a place where context is
lost and has to be re-derived.

### 3. Pick the shape

| Shape | Use when | Fails when | Tell-tale of the failure |
|---|---|---|---|
| **Single** | task fits one context; one skill set | context fills | it contradicts its own earlier decisions |
| **Orchestrator + subagents** | subtasks independent, each context-narrow | subtasks need each other's intermediate state | the orchestrator re-explains the same background to every subagent |
| **Sequential handoff** | distinct expertise, clean artefact between stages | the artefact is underspecified | each stage re-derives what the last one knew |
| **Deterministic pipeline** | the step is mechanical | you needed judgement after all | brittle special-casing accumulates at one step |

### 4. Define the artefact at every boundary

A handoff is only as good as what crosses it. For each boundary, write down: what is
passed, in what format, and what the receiver may assume. **An underspecified artefact is
the single most common cause of multi-agent systems performing worse than one agent.**

### 5. Decide what each agent may not do

Topology is not just who does what — it is who **cannot** do what. A reviewing agent that
can edit will eventually edit. Put the boundary in the harness (`disallowedTools`), not in
the prompt. See `harness-audit`.

### 6. Write the exit condition

For each choice: *what would show this was the wrong shape?* A design without one cannot
be evaluated, only defended.

## Red flags

- The diagram has an agent whose job is "coordinate" and nothing else.
- Two agents both need the same large context — they are one agent.
- An agent's output is only ever read by the agent that called it, unchanged.
- You cannot say what any boundary artefact contains.
- The topology grew because quality was poor, without a diagnosis of why.

## Rationalizations, and the rebuttals

- *"More agents means more specialisation."* It also means more boundaries, and each one
  loses context. Specialisation is free within one agent; boundaries are not.
- *"An orchestrator will keep it organised."* An orchestrator adds a context bottleneck.
  Organisation is a property of the artefacts, not of having a coordinator.
- *"We'll define the handoff format later."* The handoff format *is* the design. Later
  means each side invents its own.
- *"Subagents are cheap."* Each one re-reads its context from zero. That is the cost, and
  it is paid every invocation.

## Verification

- Every box justified as needing judgement rather than execution.
- Every boundary has a written artefact spec.
- Every agent has a stated write boundary, enforced where it matters.
- Each choice has an exit condition.
- The ADR in `design/` records what was rejected and why.

## When to stop and ask

- Two topologies have materially different cost and no evidence separates them.
- The shape depends on a fact about the target system you cannot verify.
- The design implies a T3 or T4 move.
