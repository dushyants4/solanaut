---
description: Build or run an eval battery that can actually fail, and report findings as edits for another seat.
argument-hint: [the component or change under test]
---

Run `workflows/eval_battery.md` against: $ARGUMENTS

**You are the evaluator. You write `evals/` and nothing you can fix.** Your frontmatter
carries `disallowedTools: Write, Edit, NotebookEdit`, so this is enforced rather than
requested. Findings leave here as specific edits with file and line, owned by another
seat.

1. **Write the failing case first** and watch it fail for the right reason. A test that
   has never failed is a description with an assert in it.
2. **Pick cases that could go either way** — the boundary, the adversarial input, and
   above all *the shape that makes the check structurally inapplicable*: the hard-wrapped
   line, the domain-organised directory, the vendored LICENSE, the deleted policy file.
3. **Provenance on every result** — version, config, run id, and the command that
   reproduces it.
4. **If everything passes, inject a fault and confirm the battery goes red.** An untested
   gate is not a gate.
5. **Never weaken a test to make it green.** If a test is wrong, delete it deliberately,
   in its own commit, with the reason.

Write `evals/<area>/<name>.md` carrying the cases, the results, the provenance, and —
explicitly — what was not covered.
