---
type: source
status: current
url: "https://github.com/joshpocock/karpathy-obsidian-vault"
title: "karpathy-obsidian-vault"
publisher: "joshpocock (GitHub)"
published: "undated"
fetched: 2026-09-27
checked: first-hand
created: 2026-09-27
updated: 2026-09-27
---

# The Karpathy LLM-wiki vault template

The pattern Solanaut's knowledge vault follows (`design/ADR-007-knowledge-vault.md`).

## Key facts

- **Its layers** (`CLAUDE.md`):
  - `raw/` is an "immutable inbox for source material".
  - `ai-research/` has "one file per source, never overwrite".
  - `wiki/` holds summaries and organised knowledge.
  - `output/` is for temporary artefacts and reports.
- **Its operations:** Ingest ("compile"), Research, Query, Lint, and fixing lint issues.
  - "Never invent claims. Every sentence in a wiki article must trace back to a raw source."
  - Every wiki article carries "a `**Source:**` line".
- **Its log:** `wiki/log.md` is append-only, with entries in the form
  `## [YYYY-MM-DD HH:MM] operation | short description | files touched`.
- **Its index:** `wiki/_master-index.md` lists every topic. "Every ingest updates it. Every query reads
  it first."
- **Its settings:** `.obsidian/app.json` sets `attachmentFolderPath` to `raw/assets`.
  `core-plugins.json` is an object map.
- **Its plugins:** it commits community plugins (Dataview's `main.js` at 1.3 MB, Local Images Plus at
  724 KB) and a theme.
- **Its scale:** it works well up to "about 500 articles".

## What it supports

- `design/ADR-007-knowledge-vault.md`
- `workflows/knowledge.md`

## Caveats

- **Solanaut departs from it in three places:**
  - relative markdown links instead of `[[wikilinks]]`, for GitHub;
  - summaries and short quotes instead of full text, because the repository goes public;
  - no vendored community plugins, because of third-party code and the §9 disclosure.
