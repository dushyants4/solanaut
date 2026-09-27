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
