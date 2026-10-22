# Style

How Solanaut's TypeScript is written. These conventions come from the way DHH and 37signals write software: the
Rails Doctrine ("exalt beautiful code", "convention over configuration"), 37signals' own `STYLE.md`, and their
essays "Fractal journeys", "Vanilla Rails is plenty" and "Clarity over brevity". Code here is read far more often
than it is written, by operators, auditors and other agents, so it is written to be read.

## A file reads top to bottom

- It opens with a few sentences of prose: what this file is for, and why it exists.
- Then the public entry points, then the helpers they call, in the order they call them. A reader meets
  `createGuard` before the eleven things it uses.
- Helpers that sit below their callers are `function` declarations, which hoist. A `const` arrow evaluated when the
  module loads must stay above its first use.
- Imports go at the top, always.

## A function tells one story at one level

- A high-level function orchestrates named steps in the domain's words, and leaves the mechanics to the steps:

  ```ts
  const effects = decode(proposal);
  const telemetry = senseLoop(effects);
  return firstDenial(effects) ?? allow(effects);
  ```

- If a function mixes reading bytes with deciding policy, split it at that seam, even when a step is a single line.
- No layers for their own sake: no service, manager or wrapper without a second caller or a real boundary to hide.

## Names say what things are

- `effects`, `totals`, `decision`, `limit`, `token`, `entry`; not `e`, `t`, `d`, `l`, `x`. Long names look
  silly only until the first time you come back to the code.
- One-letter names are kept for indices (`i`) and for the bytes being read in a tight decoder loop.
- A function that converts names both directions: `lamportsToSol`, `solToLamports`.

## One statement per line

- One statement per line, and lines of at most about 120 characters.
- A condition with more than three clauses is broken across lines, one clause per line, or named:
  `const sameFile = before.ino === after.ino && before.dev === after.dev`.
- An object literal with more than four or five fields gets one field per line.

## Conditionals are written out

- Prefer `if`/`else` to nested ternaries. A single ternary for a value is fine; a chain of them is a lookup table
  or an `if`.
- Guard clauses belong at the top of a function, to refuse what it cannot work with, and then the main body.

## Comments say why

- Good names carry *what*. Comments carry *why*: the reason a limit is what it is, the attack a check stops, the
  upstream behaviour being worked around.
- A defect or design reference follows the explanation in parentheses, and never stands alone:
  `// Keel coerces null and strings, so telemetry is checked before Keel sees it (defect D3).`

## What a reshaping never changes

- Behaviour. Every string a user, operator or record can see, every key that is hashed, and the order of keys in
  an object literal stay byte for byte the same.
- Exported names, file names and file boundaries: the mutation, coverage and fault gates are keyed to them.
- Tests. A reshaped line that a fault campaign targets is rewritten in that campaign in the same commit, to the
  same mutation, and the campaign is run.
