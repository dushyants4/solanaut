# ADR-007 · The repository is an Obsidian vault, run on the Karpathy LLM-wiki pattern

**Status:** accepted 2026-09-27, at the human's request ("an administrative knowledge management system
using an Obsidian vault… in the root directory of this folder").

## Context

- **Knowledge was spread out.** It sat in `runs/` (sessions), `design/` (decisions), `docs/` (claims,
  architecture), `evals/` (receipts) and `kb/` (intake and pins). Nothing summarised a milestone
  across sessions, and research facts had nowhere to live except the documents that cited them.
- **The requirement:** a vault with clear categories (milestone reviews, research, references), and a
  standard template and workflow for capturing knowledge at the end of each milestone.
- **The reference pattern** is
  [joshpocock/karpathy-obsidian-vault](../kb/sources/2026-09-27_karpathy-obsidian-vault.md):
  - an immutable raw inbox, one note per source, a compiled wiki with a master index, and an
    append-only log;
  - "Never invent claims. Every sentence in a wiki article must trace back to a raw source."
- **Constraints of its own:**
  - the repository will be public, so judges read it on GitHub;
  - Colosseum requires disclosing third-party code;
  - the human sometimes opens confidential material read-only.

## Decision

1. **The repository's root is the vault.** `.obsidian/` commits shared settings only: app,
   core-plugins, templates, graph, bookmarks. Per-user state, community plugins and themes are
   ignored.
2. **The layers map onto what exists** (`workflows/knowledge.md`):
   - raw inbox → `Docs-Dashy-Drop/`, the human's, which the guard already keeps agents out of. New
     notes and attachments made in Obsidian land there.
   - sources → `kb/sources/`, wiki → `kb/wiki/`, master index → `kb/INDEX.md`, log → `kb/LOG.md`.
   - milestone reviews → `kb/milestones/`, templates → `kb/templates/`.
   - the document register → `kb/DOCUMENTS.md`.
3. **Three departures from the reference:**
   - relative markdown links, not `[[wikilinks]]`, so pages render on GitHub;
   - summaries and short quotes, never full text, because the repository goes public;
   - no vendored community plugins (the reference ships about 2 MB of third-party JavaScript), and
     nothing requires one.
4. **Confidential material goes in `kb/private/`,** which is gitignored except for its README.
   - A committed page states a lesson from it in Solanaut's own words, with a public source, or not at
     all.
   - The folder is on this disk only, a deliberate exception to standing rule 7.
5. **Every milestone closes with a review** (`workflows/milestone_review.md`, `/milestone`). The review
   covers outcome, delivered, measured, decisions, failures at the same size as passes, knowledge
   compiled, claims, documents, risks, the next milestone, lint and sign-off. Then comes a
   `milestone/<id>` tag.
6. **The checkable half is a gate.** `tools/kb_lint.py` checks links, frontmatter, orphans, the document
   register, the private folder and the seat table. It is shown failing on injected faults first, and
   runs in `tools/session_close.py`.
7. **Owners:** the archivist writes `kb/`, and the harness owns `.obsidian/`. Obsidian is a reader;
   nothing requires it to build or test.

## Consequences

- **One graph.** Documents, decisions, runs and knowledge are linked and searchable in Obsidian.
- **Every research fact has a home** with its URL and dates. `docs/CLAIMS.md` cites those notes.
- **Private notes can be lost with this disk.** That is the accepted cost of never pushing them.
- **The log and indexes cost a few minutes per operation.** Lint catches drift they would otherwise
  hide.

## Would show this was wrong

- The wiki passes about 500 notes, the reference's own stated limit. Then split topics or add search.
- Obsidian rewrites links on a rename in a way that breaks them on GitHub. Then turn off
  `alwaysUpdateLinks`.
