---
description: Ingest what is new in the human's drop into the knowledge base — register it, compile it into sources and wiki pages, update the index, log it.
argument-hint: [optional: a file or topic to focus on]
---

Compile the knowledge base. Focus: $ARGUMENTS

Run the **Ingest** operation of `workflows/knowledge.md`:

1. `uv run --script tools/kb_lint.py` lists drop files that are unregistered or changed since they
   were registered.
2. Register each one in `kb/intake/YYYY-MM-DD_<slug>.md`, with its SHA-256. **Never write into
   `Docs-Dashy-Drop/`**: it is the human's, kept byte for byte.
3. Compile: outside facts go into `kb/sources/` (checked against their original source, never taken
   from the drop's own say-so), and understanding goes into `kb/wiki/<topic>/`.
4. Update `kb/INDEX.md`. Log the operation in `kb/LOG.md`.
5. Run `tools/kb_lint.py` again. It must be green.

Report what was ingested, and anything in the drop that contradicts `docs/CLAIMS.md`. That is the
human's to settle.
