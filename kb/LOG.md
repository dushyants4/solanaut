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

## [2026-09-27 17:33] file-back | the human asked for the whole pitch in four paragraphs (what, why, how, results); the answer is filed as PITCH.md Draft 2, traced to CLAIMS rows | docs/submission/PITCH.md, docs/submission/SUBMISSION.md, kb/DOCUMENTS.md

## [2026-09-30 23:49] research | the verified review: about 30 primary sources read directly (Solana's v1 pages, Squads v4's source, Phantom's docs, kit and Solana Agent Kit interfaces, npm, Anza, SIMD-0312, Alpenglow, Kora, coldstar-agent-signer, Lighthouse, OWASP, npm trusted publishing, verified builds); 22 source notes, 3 of them via-agent | kb/sources/2026-09-30_*.md

## [2026-09-30 23:49] fix | Privy's lookup-table gap re-checked through a search of its page; the competitor page's claim that on-chain caps "are audited" narrowed to Swig's sourced audit | kb/sources/2026-09-27_privy-solana-policies.md, kb/wiki/competitors/_index.md

## [2026-09-30 23:49] restructure | compiled into the wiki: v1, durable nonces and pinned tables; Squads' membership answer; a Phantom entity page; a readiness-standards page; new glossary terms | kb/wiki/solana/_index.md, kb/wiki/competitors/_index.md, kb/wiki/competitors/squads.md, kb/wiki/competitors/phantom.md, kb/wiki/security/readiness-standards.md, kb/wiki/security/_index.md, kb/wiki/glossary.md

## [2026-09-30 23:49] file-back | the 26 verified findings, filed as docs/SPEC.md Draft 2, ADR-008 (proposed) to ADR-011, and the threat model's Draft 2; the roadmap and readiness plan as achievement-based milestones, at the human's instruction | docs/SPEC.md, design/ADR-008..011, docs/papers/THREAT-MODEL.md, docs/PRODUCT.md, docs/ROADMAP.md, docs/READINESS.md

## [2026-09-30 23:49] review | milestone R2 · the verified review and a roadmap by achievement | kb/milestones/2026-09-30_R2-verified-review.md, kb/INDEX.md, kb/DOCUMENTS.md, kb/REGISTRY.md, PROGRESS.md
