# 2026-09-27 · research-foundation

## Asked

The human's words, condensed; three messages over the session:

1. **The first stage, before development.**
   - Research Gubernaut and its latest governor architecture, including a confidential workspace the
     human opened read-only "with explicit permission over rules".
   - Research Solana DeFAI: what is happening, the problems, the solutions.
   - Recommend how to build a high-value MVP on it.
   - Update the documentation and the roadmap, and produce "all important paper works and documents,
     draft 1", to be updated from time to time.
2. **A structured overview** of the codebase and domain: architecture, dependencies, logic and data
   models, configuration and constraints.
3. **An Obsidian vault** at the repository's root, for administrative knowledge management. It should
   follow [joshpocock/karpathy-obsidian-vault](https://github.com/joshpocock/karpathy-obsidian-vault),
   with clear categories and a standard template and workflow for closing each milestone.

**The human's decisions in session:**
- confidential findings go into git only in public-safe form, with the detail in a gitignored
  `kb/private/`;
- the business plan sets out both paths and recommends one;
- H3 composes with Squads v4 plus a tiny program of Solanaut's own.

An earlier request in the session (audit the repository and update every `.md`) was superseded by
these, and its useful part was folded in.

## Did

1. **Read the whole repository** (75 tracked files), then planned in plan mode. The plan file could not
   be written: plan mode writes to `~/.claude/plans/`, which Solanaut's own guard denies
   (`machine-agent-config`). The plan was delivered in chat, and the human approved it.
2. **Researched in parallel** with three read-only agents: the private governor architecture, the
   public record of Gubernaut, and the Solana DeFAI landscape.
   - One batch of reads in the private workspace was refused by the permission classifier as PII
     handling. It listed the workspace's git metadata and a personal-reports folder, and it was not
     retried by any route.
3. **Re-read first-hand every fact bound for `docs/CLAIMS.md`:** incidents, Gubernaut's releases,
   limits and receipts, Solana's docs, competitors' docs, Colosseum's page and FAQ, and the security
   literature.
4. **Built the vault:**
   - `.obsidian/` settings;
   - `kb/INDEX.md`, `LOG.md`, `DOCUMENTS.md`, and 8 templates;
   - `workflows/knowledge.md` and `workflows/milestone_review.md`; `/compile` and `/milestone`;
   - 31 source notes, 9 topic pages, and one private note (untracked).
   - Committed and pushed as `235f343`.
5. **Wrote** `docs/SPEC.md`, `docs/OVERVIEW.md`, ADR-004 to ADR-007, the four papers and the three
   submission drafts. **Revised** `docs/CLAIMS.md`, README, ARCHITECTURE, HACKATHON, PROGRESS,
   CLAUDE.md, TOOLCHAIN and REGISTRY, and the office's stale instructions.
6. **Built `tools/kb_lint.py`,** showed it failing on injected faults, and added it to
   `tools/session_close.py` as a gate (`evals/harness/kb_lint.md`).
7. **Wrote the milestone reviews** for phase 0 (retroactively) and for R. Closed with every gate
   green, committed, tagged `milestone/0` and `milestone/R`, and pushed.

## Changed

| Files | Why |
|---|---|
| `.obsidian/*.json`, `.gitignore` | the vault's shared settings; per-user state and `kb/private/*` ignored (ADR-007) |
| `kb/INDEX.md`, `LOG.md`, `DOCUMENTS.md`, `templates/`, `sources/`, `wiki/`, `milestones/`, `private/README.md` | the knowledge base (ADR-007) |
| `kb/REGISTRY.md` | the frameworks' web3.js base confirmed; upstream findings U-1 to U-4 |
| `workflows/knowledge.md`, `workflows/milestone_review.md`, `plugins/archivist/commands/{compile,milestone}.md` | the vault's operations and the milestone ritual |
| `docs/SPEC.md`, `docs/OVERVIEW.md`, `design/ADR-004…007` | the MVP baseline, the codebase overview, the decisions |
| `design/ADR-001-architecture.md` | status line: point 4 superseded by ADR-006 |
| `docs/papers/*`, `docs/submission/*` | draft-1 papers and submission drafts |
| `docs/CLAIMS.md` | IDs; S4 narrowed; G6 corrected; G7, G8, M1–M9 added; words added |
| `README.md`, `docs/ARCHITECTURE.md`, `docs/HACKATHON.md`, `PROGRESS.md`, `CLAUDE.md`, `TOOLCHAIN.md` | the research folded in; an R phase; the vault; the rule for private material; the plan-mode note |
| `workflows/session_close.md`, `workflows/triage.md`, `workflows/new_project.md`, `plugins/archivist/*`, `plugins/architect/skills/context-budget/SKILL.md`, `plugins/VENDORED.md` | vendored instructions that did not fit Solanaut, corrected; unresolvable `kb/GAPS.md` citations explained |
| `tools/kb_lint.py`, `tools/session_close.py`, `evals/harness/kb_lint.md`, `evals/README.md` | the vault's gate, shown failing first |
| `package.json` | its description no longer says "setup and first slice" |

**Not changed:** no product code; `packages/` and `apps/` are untouched.

## Found

- **Keel 1.0.1's digest is a constant (U-1, first-hand).** `dist/index.js` sets
  `var wasmDigest = WASM_SHA256;` and checks only the byte length, while the README says the controller
  is verified "again on load". Solanaut's startup check therefore compares two constants, and
  `docs/CLAIMS.md` S4 overstated it. It is narrowed now, and H1 hashes the bytes (D4).
- **Defects in the current guard, found by reading** (`docs/SPEC.md` §10):
  - D1: `guard.policy` is mutable (`Readonly<>` is shallow);
  - D2: the policy is never validated (a NaN cap disables its check);
  - D5: decoding runs outside the fail-closed boundary;
  - D6: no SPL, v0 or fee coverage, so allowlisting the Token Program allows any token transfer;
  - D9: amounts are JS numbers.
- **The prior-work disclosure draft was wrong twice.** `@gubernaut/core` was published on 2026-08-07,
  not "in July". And "everything written during the contest" ignored the office tooling vendored from
  earlier private work. Corrected in `docs/submission/SUBMISSION.md`.
- **AIXBT was a breached dashboard, not a prompt injection.** The agent's summary had framed it as
  one; the first-hand read and its maintainer's statement corrected it (M2).
- **Caps and allowlists are table stakes** (Privy, Turnkey, Coinbase, Squads, Swig). The research found
  no product documenting retry, fee-escalation or double-send control. That opening is the pitch, and
  "the only" stays banned.
- **Plan mode is blocked by the guard.** The fix, `plansDirectory`, exists in the settings schema, but
  the edit to `.claude/settings.json` was **denied by the permission classifier** as self-modification.
  It is the human's.
- **`kb_lint.py` failed on its own first run.** git quotes non-ASCII paths, so the drop's `×` file dodged
  the exemption and could not be opened. It failed loudly as designed, and was fixed with
  `-z` and `core.quotePath=false`.
- **A miscount, caught before closing.** The vault commit `235f343` says "29 re-read first-hand". The
  count is **30 first-hand and 1 via-agent**; the milestone review states it correctly.
- **Not verified:** Swig's program ID; v1's rollout date; Anderson's 1972 text, which NIST's scan would
  not yield, so NIST's definition is cited instead.
- **For the human only, not committed:** two findings about the private workspace's governor. They are in
  `kb/private/`, and were stated in the session.

## Open

1. **The human's:**
   - `.claude/settings.json`: add `"plansDirectory": "./docs/plans",` after the `$schema` line;
   - a licence;
   - repository access for the judges;
   - the Colosseum fields, videos and submission;
   - a Colosseum Copilot check against Sudont, AgentVeins and BlockHelix;
   - sign-off on the milestone reviews and the business plan.
2. **H1:**
   - D1–D9, test-first;
   - reproduce U-2 and U-3;
   - read the versioned-transactions page (v1).
3. **H3:** the half-day Squads spike (the program ID, and whether a member can spend with no
   permissions).
4. **Not backed up by design:** `kb/private/`, the only work in this folder not pushed.

## Provenance

- **Toolchain:** Node 26.7.0, `@gubernaut/core` 1.0.1, `@solana/web3.js` 1.99.0, uv 0.12, Obsidian
  1.13.7.
- **Research dates:** every source note carries its URL, published date and fetched date (2026-09-27).
  `checked: first-hand` means re-read in this session.
- **Regenerate:**
  - `uv run --script tools/kb_lint.py`
  - `uv run --script tools/session_close.py --slug research-foundation`
  - the first-hand count: `grep -l "^checked: first-hand" kb/sources/*.md | wc -l` → 30
- **The digest finding:** `grep -n "wasmDigest\|WASM_SHA256\|WASM_BYTE_LENGTH" node_modules/@gubernaut/core/dist/index.js`.
