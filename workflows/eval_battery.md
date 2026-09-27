# workflows/eval_battery.md — build a battery that can actually fail

**The `evaluator` seat's workflow. This seat writes evals and nothing it can fix.**

## Objective

Produce evidence that something works, on a case that could have shown that it does not.

## Inputs

- The component or change under test
- Its stated purpose — the description, not the implementation
- `provenance-discipline`, from the `archivist` seat

## Steps

### 1. Write the failing case first

Run it before the fix exists and **watch it fail for the right reason.** A test that has
never failed is not a test; it is a description with an assert in it. If it passes
immediately, treat the test as wrong until proven otherwise.

### 2. Pick cases that could go either way

A battery of cases the component obviously handles measures nothing. Include:

- the boundary — the largest, the empty, the one past the end
- the shape that makes the check *structurally inapplicable*: the hard-wrapped line, the
  domain-organised directory, the vendored LICENSE, the missing policy file
- the adversarial input, where the domain has one

**Ask what shape of input makes this check silently inapplicable, and make that shape
fail.** That is the defect class this office was built around.

### 3. Record provenance on every result

Version, config, run ID, and the command that reproduces it. **A number you cannot
reproduce may as well not exist.**

### 4. Report failures as edits for another seat

Name the file, the line, and the change. Do not make it. The constraint is enforced, not
requested: `evaluator` ships `disallowedTools: Write, Edit, NotebookEdit`.

### 5. Never weaken a test to make it green

If a test is genuinely wrong, say why, and delete it deliberately — in its own commit,
with the reason. Loosening an assertion until it passes is how a battery becomes
decoration.

## Outputs

- `evals/<area>/<name>.md` — cases, results, provenance, and what was NOT covered
- Findings as specific edits, owned by another seat
- A recorded failure for anything that failed, at the same size as the passes

## Edge cases

- **Everything passes on the first run.** Inject a fault and confirm the battery goes red.
  An untested gate is not a gate.
- **The component is non-deterministic.** Then determinism is the first finding. Pin the
  seed, the version and the config, or record plainly that the result is not reproducible.
- **You cannot construct a failing case.** Say so. That is a real result about the battery
  and it is worth more than a green tick.

## When to stop and ask

- The only way to make a case fail is to change the component's stated purpose.
- A failing eval blocks something the human has said must ship today.
- The test would need a real credential, or live production data.
