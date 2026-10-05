# 2026-10-05 · The handoff to Codex: Leg 2 won, Leg 3 handed over

## Asked

The human wants Codex to take over development, running long sessions, while Claude returns later to resume and
finalise. The request:

> "the rest of the development for Solanaut which can be super ambitious and go according to the plan … draft a
> agents.md because for the time being, the development is going to be taken over by Codex … write a clean transfer
> record so I can invoke a new session in the root directory … just give me a prompt that I can feed to this new agent
> … set up this project folder in order for a complete clean transfer"

The machine's Codex config names the model `gpt-6.1-sol`. The human plans to run it at a light reasoning effort, for
longer runs.

## Did

1. **Asked the human the three decisions that set where Codex starts.** All three answers took the recommended option:
   - **the Beta review:** signed off (2b.4), so it is tagged `milestone/beta`;
   - **the Alpha's scope (2c.1):** approved as drafted: SPEC §13, ADR-013 to ADR-018, the risk register and the
     thresholds;
   - **ADR-012:** option C accepted, to be built first under Codex.

   With these, **Leg 2 is won.**
2. **Checked what Codex would actually run under.** Codex 0.155.0 has hooks turned on. It loads a trusted folder's
   `.codex/` (config, hooks, rules); this folder has a trust entry. Its hooks take Claude Code's shape for shell calls.
   It edits files with `apply_patch`, which the boundary guard did not know.
3. **Extended the boundary guard to Codex, test-first (T3).** The receipt is `evals/harness/boundary_guard.md` §4.
   - **What changed:**
     - `apply_patch` is parsed, and every file a patch touches is checked;
     - shell commands that name the never-read paths are refused, even when they only read;
     - a protected path is matched in more spellings;
     - a Codex-only rule protects the law, the harness and the gates from Codex;
     - `.git/hooks` and `.git/config` are protected;
     - denials exit 2, and a crash of the guard is a denial;
     - `2>&1` no longer counts as a write.
   - **The run:** 18 new cases all failed first, then 59 of 59 passed. Eleven Codex-shaped payloads, piped through the
     hook's exact command, each gave its expected exit code.
4. **Set up `.codex/`:**
   - **`hooks.json`:** the guard, with `--harness codex`.
   - **`config.toml`:** a workspace-write sandbox with the network on, and writable roots for `.git` and the caches.
     `codex debug prompt-input` shows a session in this folder loading exactly these settings.
   - **`rules/solanaut.rules`:** T4 commands forbidden, plus `ssh`, `scp` and `gh api`. Checked with
     `codex execpolicy check` against the machine-wide rules as well: a project `forbidden` outranks a global `allow`.
5. **Wrote `AGENTS.md`,** the law for Codex. Codex loads it in full: 14 KB, under its 32 KiB limit.
6. **Wrote `docs/HANDOFF.md`,** the transfer record:
   - the state at the transfer;
   - the decisions;
   - what Codex owns;
   - a 12-item work queue by requirement ID;
   - requests for the human, H1 to H6;
   - Codex's owed edits and log;
   - the hand-back checklist;
   - the lessons from the Beta.
7. **Recorded the decisions everywhere they live:**
   - ADR-012 to ADR-018 accepted;
   - SPEC Draft 4.1; READINESS 2.0; RISKS 1.0; ROADMAP Draft 3;
   - the Beta review signed off;
   - PROGRESS, CLAUDE.md, README, the register and the log.

## Changed

- **The guard (T3):**
  - `tools/boundary_guard.py`: patches, shell reads, harness rules, exit 2, fail-closed on a crash, REDIRECT;
  - `plugins/harness/hooks/boundaries.toml`, version 2;
  - `evals/harness/boundary_guard.md` §4;
  - `evals/README.md`.
- **Codex's harness:** `.codex/hooks.json`, `.codex/config.toml` and `.codex/rules/solanaut.rules`, all new.
- **The transfer:** `AGENTS.md` and `docs/HANDOFF.md`, both new.
- **The decisions:**
  - `design/ADR-012` to `ADR-018`;
  - `docs/SPEC.md`, `docs/ROADMAP.md`, `docs/READINESS.md` and `docs/RISKS.md`;
  - `kb/milestones/2026-10-01_2b-beta.md`;
  - `PROGRESS.md`, `CLAUDE.md` and `README.md`;
  - `kb/DOCUMENTS.md` and `kb/LOG.md`.

## Found

- **Codex's file edits would have been unguarded.** The guard knew only Claude Code's tool names. It is fixed, with
  the self-test and an end-to-end pipe, but **a live Codex session firing the hook is not yet proven.** That needs
  Codex running, so it is item 0 of the queue, every session.
- **Codex reads only through the shell, and no harness setting denied it the Gubernaut workspace.** The never-read
  paths are now refused by name. The match is heuristic, and `--explain` lists its bypasses.
- **The guard counted `2>&1` as a write.** It was found when a probe of the sandbox was refused, and shown failing
  before the fix.
- **This session's own commands were refused about six times** by the extended guard. In each, the command named the
  Gubernaut workspace, `~/Work` or `~/.codex` beside a write, or `git push` as a test string. Each refusal held as
  specified, and each edit went through a script file or the file tool instead.
- **Codex ignores `skills.config` in a project's config.** Six of Gubernaut's skills load machine-wide into every Codex
  session, this one included. The same setting worked as a `-c` override, so the ineffective lines were removed, not
  left looking as if they worked. `AGENTS.md` forbids the skills, and the human's fix is below.
- **`codex sandbox` does not read the project layer.** A receipt line written from that assumption was corrected before
  commit. What a session loads was shown with `codex debug prompt-input` instead.
- **`gh` hangs on every command,** including `gh auth status`, while `git push` works. It is probably a locked keyring.
  A first `npm test` run looked like a 10-minute hang: it was the `gh` call after it, and the summary filter was also
  wrong. The suite itself passes 161 of 161 in 7 seconds.
- **The devnet keys hold little SOL:** the agent 0.032, the operator 0.277 and the treasury 0.059. That is not enough
  for 3.7's program deploy, nor perhaps for the scenes' re-run.
- **`solana-verify` and Surfpool are not installed;** Docker is.
- **A decisions script stopped halfway,** because ADR-015 was named twice in the SPEC. The edits it had made were
  kept, and the rest re-run.

## Open

1. **For the human, in `docs/HANDOFF.md` §5:**
   - H1, devnet SOL;
   - H2, Surfpool;
   - H3, `solana-verify`;
   - H4, OS users;
   - H5, the Gubernaut skills;
   - H6, `gh`.
2. **Cross-folder debts.** These are not changed from here.
   - **The Gubernaut skills in `~/.agents/skills`:** `astro-component`, `claims-check`, `copy-draft`, `gate-run`,
     `receipt-write` and `token-apply`. Two ways to stop them loading here:
     - **move them** into Gubernaut's own repository, under `.agents/skills/`, where Codex finds them only in that tree;
     - **or launch Codex in this folder with a `-c` override,** one entry per skill:

       ```
       -c 'skills.config=[{path="/home/dashy/.agents/skills/astro-component/SKILL.md",enabled=false}, …]'
       ```
   - **The machine-wide Codex rules** allow `ssh` and `gh api` unrestricted. Here the project's rules forbid them.
     Whether they should be allowed elsewhere is the human's call.
3. **The live hook probe,** the first thing Codex does.
4. **The return:** Claude applies §6, reviews, runs RT-2, and writes the Alpha's review with the human.

## Provenance

- **Versions:** Codex CLI 0.155.0, with model `gpt-6.1-sol` in `~/.codex/config.toml`. Node 26.7.0, Python 3.14.7.
- **Regenerate:**
  - `uv run --script tools/boundary_guard.py --selftest` (59 of 59);
  - `npm test` (161 of 161);
  - `codex execpolicy check --rules .codex/rules/solanaut.rules <command>`;
  - `codex debug prompt-input` in this folder (what a session loads).
- **Commits:** this session's commits on `main`, and the tag `milestone/beta`.
