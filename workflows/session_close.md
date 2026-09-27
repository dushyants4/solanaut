# workflows/session_close.md — close every session

**Not optional. Do it without being asked.**

## Objective

Nothing durable is left only in a context window or only on this disk.

## Why this workflow exists

The Office this workflow was vendored from once lost a charter to a disk failure. It was
gitignored, had no git history, and the only surviving description of it was a single line in
another file. What replaced it is a reconstruction that says openly it may be worse than what it
replaced. Solanaut inherits the rule so it never learns the same lesson itself.

**If it is not pushed to a remote, it does not exist.**

## Inputs

- What happened this session
- `git status`
- Any `.md` the work made inaccurate

## Steps

### 1. Write the run record

`runs/YYYY-MM-DD-<slug>.md`:

```markdown
# YYYY-MM-DD — <slug>

## Asked
<the request, in the requester's terms>

## Did
<what actually happened, in order>

## Changed
<files, and why each>

## Found
<including what FAILED, at the same size as what passed>

## Open
<unfinished work, and debts owed to other folders>

## Provenance
<versions, configs, and the command to regenerate any number quoted>
```

**The `Found` section carries failures.** A run record listing only successes is the one
nobody can learn from.

### 2. Update the docs your work made wrong

Same session, not next time. At minimum check:

- `README.md` — the Status note
- `CLAUDE.md` — the architecture block and the paths table, if paths, tools or rules moved
- `PROGRESS.md` — the phase row, *Measured so far*, *Open*
- `kb/` — if a measurement changed; `kb/DOCUMENTS.md` if a document changed
- `design/` — if a decision was superseded

If the session ended a phase, also run `workflows/milestone_review.md`.

### 3. Record cross-folder debts — do not pay them yourself

Solanaut writes only its own folder. When the work made something outside it wrong (a Gubernaut
package, the machine's shared config), write **the exact edit** into the run record, addressed to
its owner.

### 4. Run the gates

```
uv run --script tools/session_close.py --slug <slug>
```

It runs every gate: the manifests, the plugin audit, the boundary guard, the knowledge vault
(`kb_lint.py`), the secret scan, the run record, the remote, the push and a clean tree. It must exit
0; the push and clean-tree gates turn green after step 6. A failing gate is a finding, not a formality
to skip.

### 5. Scan the diff for anything key-shaped

```
git diff --cached | grep -inE 'api[_-]?key|secret|token|password|BEGIN [A-Z ]*PRIVATE KEY|sk-[a-zA-Z0-9]{16}'
```

Any hit stops the commit. A secret in git history is not removed by the next commit.

### 6. Commit and push

```
git add -A
git commit -m "office: <what changed>"
git push
```

### 7. If the push fails, say so loudly

Do not retry silently and do not end the session quietly. State: what is committed, what
is unpushed, and that the work is currently one disk failure from gone.

## Outputs

- `runs/YYYY-MM-DD-<slug>.md`, committed
- Every doc the work invalidated, updated
- A clean `git status`
- A push, or an explicit loud statement that there was none

## Edge cases

- **No remote configured.** Say it plainly, every session, until it is fixed. Silence
  makes it look handled.
- **Session was tiny.** Still write the record. Small sessions are the ones nobody can
  reconstruct.
- **Work is unfinished.** Record it as open. An honest `Open` section is worth more than
  a tidy one.
- **A gate fails at close.** Record the failure and leave it open. Never weaken the gate
  to close the session.

## When to stop and ask

- The push fails for a reason you cannot diagnose.
- Recording something honestly would put a secret or personal data in a file.
