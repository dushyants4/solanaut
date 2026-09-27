# workflows/knowledge.md — ingest, research, query and lint the knowledge base

**The archivist's standing workflow for `kb/`.** The shape is Andrej Karpathy's LLM-maintained wiki,
as packaged in [joshpocock/karpathy-obsidian-vault](https://github.com/joshpocock/karpathy-obsidian-vault),
adapted to this repository in `design/ADR-007-knowledge-vault.md`.

## Objective

Knowledge compounds: a source is read once and compiled into pages, a good answer is filed back as a
page, and the next question starts from what is already known rather than from a web search.

## The layers

| Layer | Where | Who writes it |
|---|---|---|
| Raw inbox | `Docs-Dashy-Drop/` | the human only. Agents read it; the boundary guard denies them writes |
| Sources | `kb/sources/`, one note per external source | the archivist |
| Wiki | `kb/wiki/<topic>/`, each topic with an `_index.md` | the archivist |
| Registers | `kb/INDEX.md`, `kb/DOCUMENTS.md`, `kb/LOG.md`, `kb/REGISTRY.md`, `kb/intake/` | the archivist |
| Milestone reviews | `kb/milestones/` | the archivist (`workflows/milestone_review.md`) |
| Private | `kb/private/`, gitignored | the archivist, and only for material the human opened explicitly |

Obsidian is the reader. Open the repository's root folder as a vault; `kb/INDEX.md` is the front
page.

## Operations

Type the operation's name in a session, or use `/compile` for ingest.

### Ingest ("compile")

1. List what is new in `Docs-Dashy-Drop/`: files not yet in `kb/intake/`, or whose SHA-256
   changed. `tools/kb_lint.py` prints both.
2. Register each file in a `kb/intake/YYYY-MM-DD_<slug>.md` record: path, SHA-256, what it is.
3. Compile: facts become `kb/sources/` notes when they come from outside, and understanding goes into
   `kb/wiki/` pages. A drop is **a source of ideas, never of facts**. A number it states is checked
   against its original source before anything cites it.
4. Update `kb/INDEX.md`, and log the operation.

### Research

1. State the question. For anything bigger than a lookup, use a brief (`kb/templates/brief.md`).
2. Save every source actually used as a `kb/sources/` note: URL, publisher, published date, fetched
   date, key facts with short quotes, and caveats. **Summaries and short quotes only**: the
   repository goes public, so full article text is never pasted in.
3. Compile the findings into `kb/wiki/` (ingest, step 3), then log.

### Query

1. Read `kb/INDEX.md`, then the topic's `_index.md`, then the pages it names. Three or four reads
   should answer most questions; if they cannot, that is a gap worth a page.
2. Answer with links to the pages and sources.
3. **File back** an answer that took real work: make it a page, then log it as `file-back`.

### Lint

1. `uv run --script tools/kb_lint.py`. It checks links, frontmatter, orphans, the document register,
   the private folder and the seat table, and lists unregistered drops.
2. Then read: contradictions between pages, stale claims, orphan ideas, sources nothing cites.
3. Fix with `fix` entries in the log, one per change, so each fix can be reviewed.

## Rules

1. **Never invent.** Every sentence in `kb/wiki/` traces to a `kb/sources/` note, a receipt in
   `evals/`, or a run record. Inference is written as inference.
2. **Public sources only in committed notes.** Material the human opened explicitly (a private
   workspace, a confidential document) is summarised in `kb/private/` only. A committed page may
   state a lesson from it in Solanaut's own words, with a public source, or not at all.
3. **Relative markdown links, not `[[wikilinks]]`**, so pages also read correctly on GitHub.
4. **Names are lowercase with hyphens.** Source notes are `YYYY-MM-DD_<slug>.md`, dated by when they
   were fetched.
5. **The log is append-only.** Correct an entry with a new one; never edit an old one.
6. **Claims are separate.** `kb/` is what Solanaut knows. `docs/CLAIMS.md` is what Solanaut may say
   in public, and it cites `kb/sources/` notes as its evidence.

## Log format

```
## [YYYY-MM-DD HH:MM] <operation> | <what> | <files touched>
```

Operations: `ingest`, `research`, `query`, `file-back`, `lint`, `fix`, `restructure`, `review`.
Times are UTC.

## When to stop and ask

- A source contradicts `docs/CLAIMS.md`: say so to the human before changing either.
- Something in the drop looks like a secret or personal data.
- A page would need confidential material to make sense.
