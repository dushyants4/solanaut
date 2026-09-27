---
name: sdk-surface-design
description: Use when designing an SDK or public API that other people's code and agents will consume — choosing what to export, shaping errors, versioning, deprecation, and the four docs that matter. Invoke before a first release, before any breaking change, and when a library is being extracted from an application.
---

# SDK surface design

Designing the seam between your code and everyone else's.

The surveyed corpus has 3,617 components and no skill for designing a consumable
interface, despite the Agent SDK being one of the most-cited repos in it. This is the
stated purpose of the Office and it had to be authored.

## When to use

- A first public release.
- A library being extracted from an application.
- Any breaking change.
- An SDK whose users keep asking the same question — that is a surface defect, not a docs
  defect.

**When not to use.** Not for internal modules with one caller you control. The cost of
this discipline is only worth paying at a real boundary.

## Process

### 1. Name the consumer, including the non-human one

Who calls this? Increasingly the answer includes an **agent**, which changes the design:

- Agents read type signatures and docstrings, not tutorials.
- Agents cannot ask a follow-up question mid-call.
- An agent will use the first thing that looks right, so a misleadingly-named export is
  worse than a missing one.

Design so the wrong call is hard to express, not merely documented as wrong.

### 2. Export the smallest thing that does the job

Every exported name is a promise you will be asked to keep. Internal is the default.
For each candidate export, ask: *would removing this in six months break someone?* If yes,
you are committing now — decide deliberately.

### 3. Shape the errors, because they are part of the surface

A consumer must distinguish, **programmatically**:

- *you called this wrong* — their bug, fixable by reading
- *the service failed* — transient, retryable
- *this will never work* — configuration, auth, capability

Distinct types or codes. Never make a caller match on a message string; that turns your
prose into an API you did not mean to publish.

### 4. Version the contract, not the code

Breaking change means major. If you are arguing that a change is "technically not
breaking", write the migration note anyway — the argument is the signal.

Additive is minor. Fixes are patch. A version that moved with no changelog entry is a
release nobody can reason about.

### 5. Deprecate with a path

Mark deprecated **naming the replacement in the message** → keep it working for a stated
period → remove in a major. A deprecation warning that does not name its replacement is
an insult wearing a helpful voice.

### 6. Write the four docs that matter

1. **Time to first success** — one page, copy-pasteable, working in under five minutes.
2. **The three things people get wrong**, stated before they get them wrong.
3. **A real example** — not `foo`/`bar`. Something a reader recognises.
4. **The errors**, each with what to do about it.

Reference docs are generated. These four are written, and they are the ones that decide
whether anyone adopts it.

### 7. Cold-read it

Hand the quickstart to a reader with no context — a model with none is a serviceable
stand-in — and ask what confused them. You cannot judge your own quickstart: you know what
the sentence was meant to say and you read the intention rather than the words.

Read the result critically. A cold reader has no register and will confidently propose a
change the facts do not support.

## Red flags

- An export exists because deciding not to export it was harder.
- The quickstart needs a step that is not in the quickstart.
- Errors are distinguished only by their message text.
- A version moved with no changelog entry.
- The example uses `foo` and `bar`.
- You are about to publish. Stop — that is the human's, every time.

## Rationalizations, and the rebuttals

- *"We can tidy the API after launch."* After launch it has callers, and tidying is now a
  breaking change with a migration cost.
- *"It's obvious how to use it."* Obvious to you; you wrote it. Cold-read it.
- *"Nobody's using that export yet."* Then remove it now, while removing is free.
- *"Semantic versioning is overkill for us."* It is the only thing letting a consumer
  upgrade without reading your diff.

## Verification

- Every export justified as a kept promise.
- Errors distinguishable programmatically, not by string.
- Changelog entry for every version move.
- Every deprecation names its replacement.
- Quickstart executed from a clean environment, by someone who did not write it.
- Licence and attribution obligations checked.

## When to stop and ask

- A change would break an existing consumer.
- Any publish, tag, release or registry push — T4, the human's.
- Licence or attribution is unclear.
