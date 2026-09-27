---
description: Synchronise a milestone — run every gate, update the record, commit, push origin. Standing rule 7.
argument-hint: [what the milestone was, in a few words]
---

A milestone just completed: $ARGUMENTS

**Standing rule 7: synchronise at every milestone, not once at the end.** A milestone is
any one of — a leg completes · a red gate turns green · `CLAUDE.md`, `plugins/` or
`tools/` changed · the session ends.

In order, and do not reorder them:

1. **Run the gates.**
   ```
   uv run --script tools/session_close.py
   ```
   A failing gate is a finding, never a formality. Do not proceed past a red one by
   weakening it.

2. **Update the record.** `PROGRESS.md` at minimum. If this milestone made any `.md`
   inaccurate, fix it now rather than next session — `README.md`'s state section and
   `CLAUDE.md`'s architecture block are the two that rot fastest. If a phase ended, run
   `/milestone` as well.

3. **Scan the diff for anything key-shaped** before it becomes permanent history.
   ```
   git diff --cached | grep -inE 'api[_-]?key|secret|token|password|BEGIN [A-Z ]*PRIVATE KEY|sk-[a-zA-Z0-9]{16}'
   ```

4. **Commit and push.**
   ```
   git add -A && git commit -m "<area>: <what changed>" && git push origin main
   ```

5. **If the push fails, say so loudly.** Do not retry silently and do not carry on
   quietly. State what is committed, what is unpushed, and that the work is currently one
   disk failure from gone. The Office this was vendored from lost a charter that way.

`origin` is **private**. Making it public is T4: the human, at the moment, every time. A sync
never changes a repository's visibility.
