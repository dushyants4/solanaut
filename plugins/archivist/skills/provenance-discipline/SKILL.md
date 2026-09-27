---
name: provenance-discipline
description: Use whenever a number, measurement, benchmark or external fact is about to be recorded or published — attaching the version, config, run ID and date that make it reproducible. Invoke when writing a run record, quoting a figure from outside, or reviewing a document that states results.
---

# Provenance discipline

A number you cannot reproduce may as well not exist.

Answers `kb/GAPS.md` gaps 2 and 6. In the surveyed corpus, no component publishes the
version it was measured at or the task it was measured on, and three repos' licence status
was misread by asking only "is there a LICENSE file?"

## When to use

- Recording any measured result.
- Quoting a figure from outside this project.
- Writing a run record.
- Reviewing a document that states results.

**When not to use.** Not for illustrative round numbers clearly marked as such. The
discipline is for claims, not for arithmetic in an example.

## Process

### 1. Every measurement carries four things

- **the version** of what was measured
- **the config** it ran under
- **a run ID** or timestamp
- **how to regenerate it** — the literal command

Written beside the number, not in a commit message. A commit message is not where anyone
looks when they doubt a figure.

### 2. Every external fact carries its source and the date you checked

Requirements change, prices change, APIs change. An unsourced fact cannot be
re-verified — it can only be re-trusted, which is not the same thing.

Format: *what, from where, checked when.*

### 3. Record what the measurement could not see

**A count that quietly excludes what it could not read is a number that buys confidence it
has not earned.** If a tool skipped files, failed to parse some, or was structurally
unable to see a class of input, that is part of the result and belongs beside it.

Prefer a tool that says "1,541 skills, 583 files with frontmatter I could not fully parse"
over one that says "1,541 skills".

### 4. Do not infer presence from a filename

A `LICENSE` file in a repo is not necessarily that repo's licence — in the surveyed corpus
one was a vendored dependency's MIT licence, granting nothing over the code around it. A
check that asks "is there a LICENSE?" answers yes and is wrong.

Open the file. Read the first line. Record what it actually says.

### 5. Distinguish measured from claimed

A README's claim about a repo is not a measurement of that repo. In this project's own
harvest, a README advertised six harness adapters and the clone had three. When a source's
self-description conflicts with the artefact, the artefact wins and **the conflict is
recorded**, not silently resolved.

### 6. Record failures with the same weight as passes

A disproof is a result. When a check contradicts something you believed, write it down at
the same size. The record that lists only successes is the record nobody can learn from.

## Red flags

- A number in a document with no source and no date.
- "Approximately" or "roughly" attached to a figure nobody can regenerate.
- A result quoted from a summary of a source rather than the source.
- A count with no statement of what it excluded.
- A run record listing only what worked.
- A figure that has been copied between documents and now has no origin.

## Rationalizations, and the rebuttals

- *"It's obviously right."* Then recording how to regenerate it costs one line.
- *"I'll remember where it came from."* You will not, and the next reader never knew.
- *"The exact version doesn't matter here."* If it does not matter, say which versions it
  holds for. That is the same work.
- *"Nobody will check."* Someone will, at the worst possible moment, and the cost of not
  being able to answer is paid then.
- *"Adding the caveat makes the result look weaker."* It makes it look *accurate*. A
  result that overstates its confidence is the one that gets retracted.

## Verification

- Every measured number has version, config, run ID and a regeneration command.
- Every external fact has a source and a check date.
- Every count states what it excluded.
- Every licence claim traces to a file that was opened.
- Failures recorded alongside passes.

## When to stop and ask

- Recording provenance would require putting a secret or personal data in a file.
- A figure cannot be traced and is already published — flag it; do not quietly restate it.
