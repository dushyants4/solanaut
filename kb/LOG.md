# LOG — every knowledge operation, append-only

One entry per operation, newest last. **Never edit or delete an entry**; correct it with a new one.
The format and operations are defined in [workflows/knowledge.md](../workflows/knowledge.md).

```
## [YYYY-MM-DD HH:MM] <operation> | <what> | <files touched>
```

Operations: `ingest` · `research` · `query` · `file-back` · `lint` · `fix` · `restructure` · `review`.
Times are UTC.

```bash
grep "^## \[" kb/LOG.md | tail -20        # the last twenty operations
grep "| research |" kb/LOG.md             # every research pass
```

## Entries

## [2026-09-27 03:45] ingest | Docs-Dashy-Drop registered at setup, before the vault existed (logged retroactively) | kb/intake/2026-09-27_dashy-drop.md

## [2026-09-27 11:50] restructure | kb/ becomes an Obsidian vault on the Karpathy LLM-wiki pattern (ADR-007): index, log, registers, templates, sources, wiki, milestones, private | kb/INDEX.md, kb/LOG.md, kb/templates/*, kb/private/README.md, .obsidian/*, workflows/knowledge.md, workflows/milestone_review.md

## [2026-09-27 12:40] research | Gubernaut's public record: API, postures, limits, releases, on-chain receipts (EVM only); the digest-is-a-constant finding verified first-hand | kb/sources/2026-09-27_npm-gubernaut-core.md, kb/sources/2026-09-27_gubernaut-limits.md, kb/sources/2026-09-27_gubernaut-onchain-receipts.md, kb/sources/2026-09-27_gubernaut-releases.md, kb/wiki/gubernaut/_index.md

## [2026-09-27 12:40] research | the Solana DeFAI landscape: incidents re-read first-hand (Freysa, AIXBT, Fake Memories, Lobstar Wilde, Grok and Bankr, web3.js backdoor, ClawHavoc), failure data, frameworks, competitors, Colosseum | kb/sources/* (22 notes), kb/wiki/defai/*, kb/wiki/competitors/*, kb/wiki/solana/_index.md

## [2026-09-27 12:40] research | admission-control patterns, from private research material the human opened read-only; the committed distillation cites public literature only | kb/private/ (untracked), kb/wiki/security/*, kb/sources/2026-09-27_nist-reference-monitor.md, kb/sources/2026-09-27_saltzer-schroeder-1975.md, kb/sources/2026-09-27_schneier-kelsey-secure-audit-logs.md, kb/sources/2026-09-27_stripe-idempotency.md

## [2026-09-27 12:45] file-back | the glossary, from the terms the research and the spec use | kb/wiki/glossary.md

## [2026-09-27 12:18] fix | the three research entries and the file-back entry above carry estimated times (12:40, 12:45) that are later than the fact; all four were committed in 235f343 at 12:00 UTC. From here on, times are read from the clock | kb/LOG.md

## [2026-09-27 12:18] fix | found by reading: the intake record was linked from nowhere; the index now links it | kb/INDEX.md

## [2026-09-27 12:18] lint | tools/kb_lint.py created; shown failing on 8 + 2 injected faults in scratch copies and through tools/session_close.py (gate 4); the real tree green | tools/kb_lint.py, tools/session_close.py, evals/harness/kb_lint.md

## [2026-09-27 12:18] review | milestone 0 · setup, reviewed retroactively from its run record | kb/milestones/2026-09-27_P0-setup.md

## [2026-09-27 12:18] review | milestone R · the research foundation | kb/milestones/2026-09-27_R-research.md, kb/INDEX.md, kb/DOCUMENTS.md, PROGRESS.md
