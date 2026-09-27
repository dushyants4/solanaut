---
name: eval-first
description: Use before building or changing an agent, skill or prompt — write the failing case that proves the change was needed, before the change. Invoke whenever someone claims a skill, prompt or model change improves something, and whenever a component is about to be added to a library without evidence it helps.
---

# Eval first

Write the case that fails before you write the thing that makes it pass.

Answers `kb/GAPS.md` gap 2. In a 31-repo corpus, **2 of 31 repos ship an `evals/`
directory and none publishes per-component evidence** — no version measured, no task
measured on, no result without the component. A library of 926 skills with no eval is not
926 capabilities; it is 926 assertions.

## When to use

- Before adding a skill, agent or prompt change.
- When someone says a change "improves" something.
- Before a component enters a shared library.
- When a component has been in use a while and nobody knows if it helps.

**When not to use.** Not for deterministic code — that is a unit test, and it is cheaper.
This is for behaviour that varies run to run.

## Process

### 1. Write the failing case first

State the task, the input, and what a wrong answer looks like. **Run it without your
change and watch it fail.** If it passes without the change, you have learned the most
valuable thing available: the change is unnecessary.

This ordering is the whole skill. A case written after the change is a case written to
pass.

### 2. Make failure observable, not just felt

"The output is worse" is not a result. Pick something checkable:

- a string that must or must not appear
- a structure that must parse
- a file that must exist
- a tool that must or must not have been called
- an ordering that must hold

If you cannot express the failure, you cannot detect the fix, and you are about to change
something on vibes.

### 3. Run it more than once

Behaviour varies. One pass is an anecdote. Run **at least five** and record the count, not
the impression. A change from 1/5 to 4/5 is a result; a change from 1/1 to 1/1 is noise
wearing a result's clothes.

### 4. Record provenance

Every eval result carries **the model, the config, the date, and the exact input**. A
number you cannot reproduce may as well not exist. Store it beside the eval, not in a
commit message.

### 5. Keep the case after it passes

The failing case becomes the regression case. An eval deleted once green is a defect
waiting to return quietly.

## Red flags

- The eval was written after the change.
- The eval passes on the first run and you did not check it can fail.
- The result is "seems better".
- One run is being reported as a result.
- The eval asserts on wording that a correct answer could legitimately vary.

## Rationalizations, and the rebuttals

- *"The improvement is obvious."* Then the failing case takes two minutes and you lose
  nothing. If it is genuinely obvious, the case passes without your change — which is
  worth knowing.
- *"Evals are slow to write."* Slower than shipping a skill nobody can tell is working?
  The library that skipped this is the one with 926 unmeasured components.
- *"Model behaviour is non-deterministic, so evals don't work."* Which is why you run five
  and count. Non-determinism is a reason to measure, not a reason not to.
- *"I'll add the eval after."* After, you will write a case your change passes. That case
  measures nothing.

## Verification

- The case existed and failed before the change.
- The failure was observable by a stated rule, not by reading.
- At least five runs, with the count recorded.
- Model, config, date and input stored with the result.
- The case is retained as a regression.

## When to stop and ask

- The eval would need production data, a real credential, or a live user.
- Pass and fail are both defensible under the spec — the spec is the problem.
- The eval would cost meaningful money to run.
