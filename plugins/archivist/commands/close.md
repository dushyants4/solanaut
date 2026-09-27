---
description: Close the session — write the run record, update what the work made wrong, run every gate, commit and push.
argument-hint: [slug for the run record, e.g. office-pass-2]
---

Close this session properly. Run `workflows/session_close.md`. Slug: $ARGUMENTS

**Not optional, and not to be done only when asked.**

1. **Write `runs/YYYY-MM-DD-<slug>.md`** with: Asked · Did · Changed · Found · Open ·
   Provenance. **The `Found` section carries failures at the same size as the passes** — a
   run record listing only successes is the one nobody can learn from. The record is
   judgement and is written by hand; nothing generates it for you.

2. **Update every doc the work made wrong**, this session. Check `README.md`,
   `CLAUDE.md`'s project-context block, `kb/` if a measurement moved, `design/` if a
   decision was superseded.

3. **Record cross-folder debts — do not pay them.** Solanaut writes only its own folder.
   Where the work found something wrong outside it (an upstream Gubernaut package, a
   dependency), write the *exact* finding into the run record for the human.

4. **Run every gate.**
   ```
   uv run --script tools/session_close.py --slug <slug>
   ```

5. **Commit and push `origin`.** If the push fails, say so loudly — what is committed,
   what is not, and that the work is one disk failure from gone.

Then state plainly what is still open. An honest `Open` section is worth more than a tidy
one.
