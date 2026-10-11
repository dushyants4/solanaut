# PUB-1 — redirected evidence output

2026-10-11 Toronto; reviewed e537f63, Linux/Node 26.7.0. Builder-authored
local preparation, not independent review or publication clearance.

The maintained `history-bytes-run.mjs` checks lexical output containment but
does not check the resolved parent. A workspace-only directory symlink redirects
its evidence writes. `history-output/red.txt` preserves the first failure;
`current.txt` preserves the final negative failure and ordinary positive control.
All fixture paths and writes stay in this workspace and are removed afterwards.
No external path, key, private contents or actual historical blob is accessed.

Following the evaluator boundary, the maintained runner is unchanged. The exact
unapplied `history-output/owner.patch` adds `dirname` and refuses a parent whose
real path differs before creating the output directory. Read-only patch checking
passes. A separate `history-output.candidate.mjs` carries that proposed correction
and pins its own candidate/test inputs. These are proposal artefacts, not a gate fix.

Regenerate the maintained failure:

```sh
node --test evals/release/history-output.test.mjs
```

One of two cases fails. The runner succeeds through the alias, whereas the
regression requires refusal and no output-directory creation.

Regenerate the proposed-copy proof:

```sh
SOLANAUT_HISTORY_OUTPUT_DRIVER=evals/release/history-output.candidate.mjs node --test evals/release/history-output.test.mjs
uv run --script evals/release/history-output/faults.py
git apply --check evals/release/history-output/owner.patch
npm run typecheck
```

Both proposed-copy cases pass. Two faults are caught: omit the resolved-parent
check, and move it after output-directory creation. Complete two-case fault trials
have no skips, cancellations or todo cases. Exact candidate restoration and final
control pass. Raw outputs and input hashes live beside the patch; previous S128
outputs are untouched. Already installed Node 24.19.0 also passes the same two
proposed-copy cases, retained in `history-output/node24.txt`:

```sh
SOLANAUT_HISTORY_OUTPUT_DRIVER=evals/release/history-output.candidate.mjs mise exec node@24.19.0 -- node --test evals/release/history-output.test.mjs
```

The original thirteen-case S128 component control also passes, retained in
`previous-control.txt`; its source and earlier raw receipts remain unchanged.
This is not a complete runtime or release matrix.

This is static path preflight, not atomic protection against concurrent directory
replacement or a hostile host. It grants no secret, confidential-content, rights,
licence or full public-history clearance. H15's actual scope refusal and H11's
native failure remain. Nested component tests do not run through the root native
glob; no full native rerun is claimed for this evaluator-only addition. Owner
application, maintained tests and additive CI adoption remain owed.
