# 2026-10-13 · Codex's Leg 3 reviewed, and the decisions it waited on answered

## Asked

"Check progress so far and leave review for codex's work. It shall continue developing, give me a prompt I can pass it
after you run a partner session with it to keep the dev job going as per plans for open source 1.0 release."

## Did

1. **Checked progress.** Claude read:
   - `main`;
   - Codex's records since the Beta;
   - the code;
   - hosted CI on `bf743bf`;
   - the open requests and owed edits in `docs/HANDOFF.md`;
   - the three stale `codex/*` worktrees.
2. **Wrote the review,** `docs/reviews/2026-10-13-codex-leg3.md`. Codex has been safe and honest, but heavy on evidence
   and light on integrated product. The review sets a revised order of work (`docs/HANDOFF.md` §4), and rules for
   evidence, records and integration.
3. **Ran the partner session.**
   - The command was `codex exec --sandbox read-only`, session `01a13439-d8c6-7730-9d4a-950514a4a0c3`.
   - Codex read the review and checked it against the repository, then reached its account's usage limit before
     replying. The limit resets at 8:31.
   - Its notes found two errors in the draft, both corrected:
     - 3.3 depends on 3.1 for re-reading mutable settings at admission;
     - the draft missed the Phantom blocker: the stock MCP routes broadcast before they return.
   - The human's decision of 2026-10-01 keeps outside agent CLIs from running unattended from Claude's session. This
     session ran at the human's explicit request, read-only, while the human was present.
4. **Asked the human the open decisions.**
   - Accepted:
     - H11;
     - ADR-021, ADR-022 and ADR-023;
     - ADR-024, at 5 failed outcomes in 10 minutes.
   - The human then raised a new point: an agent that learns why it was refused will try to get around the rule.
     Claude drafted `design/ADR-025-denial-disclosure.md`, and the human accepted it.
5. **Recorded the answers:**
   - each ADR's status line;
   - `docs/HANDOFF.md`: §2 (the decisions), §4 (the revised order), §5 (the answers, in place) and §6 (O1 and O6
     applied).
6. **Applied two owed edits.**
   - **O6, H11's wait:** the patch went in unchanged.
     - The focused test passes 6 of 6; the staged baseline took 24.6 seconds.
     - `npm test` passes 901 of 901, in 150 seconds. It was 900 of 901.
     - The typecheck passes.
     - The receipt is `evals/ci/baseline-latency.md`, *Applied*.
   - **O1, the build convention in `AGENTS.md`:** applied. The human had approved it on 2026-10-05.
7. **Small corrections:**
   - `CLAUDE.md`'s design row now covers ADR-001 to ADR-025, with a row for `docs/reviews/`;
   - a stale comment in `.codex/config.toml` now says origin is public;
   - the reading guide and the document register list the review;
   - `PROGRESS.md` gets today's status and a plain entry.

## Found

- **Product against evidence, from the Beta to `bf743bf`:**
  - SDK source grew from 2,953 to 4,783 lines;
  - the signer is 402 lines and does not run as a process yet;
  - the MCP tool filter is 40 lines;
  - `evals/` grew from 84 files (0.7 MB) to 5,814 files (about 500 MB), while `packages/` and `apps/` are about 1.1 MB.
- **CI on `bf743bf`, run `38361405139`:** 9 of 15 jobs pass.
  - The three runtime test jobs failed `npm test` on H11. Then their installed-package fault injections ran past the
    10-minute limit, and the jobs were cancelled.
  - The AST floors failed, and so did fault partitions 1 and 2.
- **CI on `652cad5`, after O6, run `38366574082`:** 12 of 15 jobs pass, up from 9.
  - Newly green: the AST floors, the Node 22.18 test job, and fault partition 1.
  - Still red: the Node 24 and 26.7 test jobs, cancelled at the 10-minute limit about 450 seconds into the package
    fault injections, and fault partition 2.
  - Both wait on O2 and O3.
- **No requirement test exists yet** for TOK (3.3), OPQ (3.4) or DSH (3.8), and `programs/` is empty (3.7).
- **The owned facade (`owned-guard.ts`) is used only by tests.** The signer app uses the plain guard.
- **The three `codex/*` worktrees hold nothing that `main` lacks.** The checks are in the review's *Provenance*.
  - Codex's rules allow it to remove the worktrees and delete the local branches (`codex execpolicy check`).
  - Pushing those branches stays forbidden.
- **Today the agent is told the full denial reason.** `SolanautDenied` carries the rule, the reason and the decision
  (SPEC §8). This is what ADR-025 changes.

## Open

1. **Claude's next gate session:**
   - O2 and O3, with the job limits;
   - O9 and O10;
   - O7 and O8, once D41 is integrated.

   The goal is every CI job green.
2. **The human's:**
   - H1 to H5, H8 and H12;
   - the optional GitHub Support purge, from this morning's earlier session.
3. **Codex's:** the prompt below, which the human passes to Codex.

## The prompt for Codex's next session

```text
Resume Solanaut development towards the open-source 1.0 release, under AGENTS.md. Claude has reviewed your Leg 3
work, and the human has answered the decisions it was waiting on. Read these first:
1. docs/reviews/2026-10-13-codex-leg3.md, Claude's review. Its rules on integration, evidence and plain records
   apply from this session on.
2. docs/HANDOFF.md: §2 (the human's decisions of 2026-10-12 and 2026-10-13), §4 (the revised order of work, at the
   top) and §5 (the answers).
3. runs/2026-10-13-codex-review.md, what Claude changed today.

What changed since your last session:
- The repository went public on 2026-10-12, with its history rewritten to remove the human's private drop. Every
  commit ID changed; docs/HISTORY-MAP.md maps old IDs to new. Push only main (AGENTS.md, law 10). Pushing main stays
  a standing grant, and every push now publishes.
- The human accepted H11, and Claude applied O6, the 60-second harness wait. npm test passes 901 of 901, and the
  typecheck passes.
- The human accepted the following:
  - ADR-021, a 1,000-line signer budget;
  - ADR-022, enrol, anchor and rotate;
  - ADR-023, bounded state, built after the signer runs;
  - ADR-024, the failure budget, with outcomes.maxFailures 5 and outcomes.windowMs 600000;
  - ADR-025, new: denial reasons go to the operator, not the agent.
  H13 and H15 are closed. O1 is applied.
- Claude ran a read-only partner session with you on the review. You reached your usage limit before replying in
  full. Your notes had already corrected two points: 3.3 depends on 3.1 for re-reading settings, and Phantom's stock
  MCP routes broadcast before they return.

Do, in this order:
0. Item 0: probe the fence, then record the baseline (expect 901 of 901 and a clean typecheck).
1. Finish the partner session, in your run record, in at most 300 words: factual errors in the review, disagreements,
   and what it misses. If you would change the order of work, write the proposal in HANDOFF §5 for the human, and
   follow the current order meanwhile.
2. Integrate the D41 and D42 fixes from their prepared candidates, keeping their first-failure evidence. With tests and
   typecheck green, commit and push main.
3. Remove the three stale worktrees under .sandbox/ and their codex/* branches:
   - check that `git -C <worktree> status --short` still matches the review's Provenance;
   - then run `git worktree remove --force <worktree>` and `git branch -D <branch>`;
   - never push them.
4. Make the SPEC edits the accepted ADRs need, before their code:
   - SIG-11's 1,000 lines (ADR-021);
   - ANC-1 and ADR-015's seeds (ADR-022);
   - ADR-024's requirement IDs and formats;
   - SPEC §8's new SolanautDenied contract, with its frozen class table (ADR-025).
5. Build ADR-025 in the SDK's adapters, test first. Its tests and planted faults are listed in the ADR.
6. Build 3.1, the signer as a running process:
   - protected devnet key loading and the executable;
   - socket replies that follow ADR-025;
   - follow-up, and restore after a kill;
   - same-user mode, SIG-1 to SIG-11, within 1,000 lines.
   Then run it on devnet if the keys are funded (H1). If they are not, record the offline result and move on.
7. Then continue down HANDOFF §4, in this order:
   - 3.2;
   - 3.3, whose SDK decoding and classification you can take up whenever you are blocked;
   - ADR-024;
   - 3.7;
   - 3.5's offline parts, then 3.8;
   - ADR-023;
   - 3.10's preparation.

Rules for every session, from the review:
- Integrate before you add. A new component lands only when the next commit wires it into a running path.
- Keep evidence in proportion.
  - Commit at most 100 KB of raw output per receipt.
  - Keep larger raw output under .sandbox/evidence/, with its SHA-256 in the receipt, or commit it gzipped if it truly
    must be kept.
  - Never copy hosted CI logs into the repository; cite the run ID.
- Write plain records.
  - PROGRESS.md: at most five lines per session, saying what works now that did not, what broke and what is blocked.
  - HANDOFF §7: at most ten lines per session.
  - An S-, D-, O- or H-number appears only beside a plain description of it.
- Lead with the blocker. When one decision blocks the work, it goes first in §5, in one sentence that says what
  waiting costs, and again in your last message to the human. Meanwhile, do the next item that is not blocked.
- No checkpoint bundles and no full-fsck rituals. Commit and push main after each green step.
- Keep CI in view. After each push, read the run, and never turn a green job red. The fault campaigns can finish inside
  the job limit only once owed edits O2 and O3 are applied, which Claude does in its next gate session. Do not wait
  for it.
- Unchanged: test first, fresh seeds after a definition changes, planted faults, owed edits for protected files (§6),
  and every T4 action is the human's.

Stop and hand back to Claude (HANDOFF §8) when every item left needs the human or Claude.
```

## Provenance

- **Tests:**
  - `TMPDIR=$PWD/.sandbox/tmp-review npm test` passes 901 of 901;
  - `node --test evals/ci/mutation-recovery.test.ts` passes 6 of 6;
  - `npm run typecheck` passes.
- **The review's numbers:** the commands are in its *Provenance*.
- **CI:** run `38361405139` on `bf743bf`, read through GitHub's public API.
- **The partner session:**
  - the command: `codex exec --sandbox read-only -C . -o <file> "<prompt>"`;
  - session `01a13439-d8c6-7730-9d4a-950514a4a0c3`;
  - its log is in Claude's scratchpad, not committed.
