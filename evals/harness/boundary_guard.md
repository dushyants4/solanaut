# boundary_guard — the fault matrix, before and after

`uv run --script tools/boundary_guard.py --selftest`, 2026-09-27.

## 1. The territorial rules were needed

With a **draft** policy holding only the secrets rule, 14 cases failed, each one a write the
Solanaut policy exists to stop:

```
  [FAIL]  allow  write into the APEX tree
  [FAIL]  allow  write through the ~/Work symlink into APEX
  [FAIL]  allow  ..-traversal from Solanaut into APEX
  [FAIL]  allow  write the APEX VS Code workspace file
  [FAIL]  allow  write into another project (Dashy Personal)
  [FAIL]  allow  write APEX's Claude memory
  [FAIL]  allow  write the user-level Claude settings
  [FAIL]  allow  write into the shared plans folder
  [FAIL]  allow  write the Codex config
  [FAIL]  allow  write into the intake drop (read-only, byte for byte)
  [FAIL]  allow  bash rm inside APEX
  [FAIL]  allow  bash cp into ~/Work
  [FAIL]  allow  bash redirect into APEX
  [FAIL]  allow  missing cwd falls back to full enforcement (must DENY)
  19/33 cases passed
```

## 2. The guard itself had a gap: quoted redirect targets

With the full policy, one case still failed: `echo x > '<the Gubernaut workspace>/x.md'` was
**allowed** (32 of 33). The Office's redirect pattern refused any target that starts with a
quote, to keep prose like `echo "x >"` from reading as a write. But the Gubernaut workspace's
path contains spaces, so every shell redirect into it must be quoted: the one redirect this
policy exists to stop was the one shape the guard could not see.

**Fix:** a target may start with a quote when something follows the quote. A new case proves the
prose false positive stays closed (`git commit -m "... under /home/dashy/Work >"` is allowed).

**The Office's copy has the same gap.** Its paths are written through `~/Work` (no spaces), but
their resolved spellings are inside the APEX folder, which has spaces. Written up for the human
in `runs/2026-09-27-setup.md`; not fixed from here (isolation).

## 3. After

```
  [PASS]  DENY   write into the APEX tree
  [PASS]  DENY   write through the ~/Work symlink into APEX
  [PASS]  DENY   ..-traversal from Solanaut into APEX
  [PASS]  DENY   write the APEX VS Code workspace file
  [PASS]  DENY   write into another project (Dashy Personal)
  [PASS]  DENY   write APEX's Claude memory
  [PASS]  DENY   write the user-level Claude settings
  [PASS]  DENY   write into the shared plans folder
  [PASS]  DENY   write the Codex config
  [PASS]  DENY   write into the intake drop (read-only, byte for byte)
  [PASS]  allow  write Solanaut's OWN Claude memory (must be ALLOWED)
  [PASS]  allow  ordinary Solanaut write
  [PASS]  allow  relative Solanaut write
  [PASS]  DENY   write a .env
  [PASS]  DENY   write a Solana keypair by name
  [PASS]  DENY   write into keys/
  [PASS]  DENY   write the default CLI wallet shape (id.json)
  [PASS]  DENY   write a private key
  [PASS]  DENY   bash rm inside APEX
  [PASS]  DENY   bash cp into ~/Work
  [PASS]  DENY   bash redirect into APEX
  [PASS]  allow  prose ending in '>' before a closing quote, naming a protected path (must be ALLOWED)
  [PASS]  allow  bash READ outside Solanaut is not this guard's job (settings deny it)
  [PASS]  allow  bash write inside Solanaut
  [PASS]  allow  bash commit message, mandated trailer, mentions .env in prose (must be ALLOWED)
  [PASS]  allow  unguarded tool passes through
  [PASS]  DENY   malformed tool_input denies
  [PASS]  DENY   missing file_path denies
  [PASS]  DENY   missing cwd falls back to full enforcement (must DENY)
  [PASS]  allow  a foreign session writing its own repo (must be ALLOWED, not Solanaut's call)
  [PASS]  DENY   a foreign session writing a .env (must STILL DENY -- universal)
  [PASS]  DENY   POLICY DELETED -> must deny
  [PASS]  DENY   POLICY UNPARSEABLE -> must deny
  [PASS]  DENY   POLICY EMPTY (no rules) -> must deny
  34/34 cases passed
  guard behaves as specified
```

## 4. Codex, 2026-10-05: patches, shell reads, and the law Codex may not edit

Codex takes over development under `AGENTS.md`. It runs the same guard from `.codex/hooks.json`, with `--harness codex`.
Codex's hooks take Claude Code's shape for shell calls (`tool_name: "Bash"`). It edits files with `apply_patch`, which
the guard did not know: every Codex file edit would have passed unchecked.

**Shown failing first.** Eighteen new cases ran against the old guard and policy, and all 18 failed:

```
  [FAIL]  allow  bash read of the APEX tree
  [FAIL]  allow  bash read of ~/Work, spelt with a tilde
  [FAIL]  allow  bash read by relative traversal into APEX
  [FAIL]  allow  bash search of another project (Dashy Personal)
  [FAIL]  allow  bash rm in the intake drop, by its path relative to the repo
  [FAIL]  allow  bash write of a git hook
  [FAIL]  allow  codex patch adding a file in the APEX tree
  [FAIL]  allow  codex patch to the machine's Codex config
  [FAIL]  allow  codex patch adding a keypair under keys/, by a relative path
  [FAIL]  allow  codex patch moving a file into the intake drop
  [FAIL]  allow  codex patch whose second file is a .env
  [FAIL]  allow  codex patch to AGENTS.md, the law that binds it
  [FAIL]  allow  codex patch to its own hooks
  [FAIL]  allow  codex patch to a gate (session_close.py)
  [FAIL]  allow  codex patch adding a git hook
  [FAIL]  allow  codex patch naming no file denies
  [FAIL]  allow  codex patch with no readable text denies
  [FAIL]  allow  codex bash sed -i on AGENTS.md
  39/57 cases passed
```

**The guard's logic, then the policy.**
- **With the new logic and the old policy,** 10 still failed: the four reads, the git hook (twice) and the four
  Codex-only cases. Each needs a rule the old policy did not have.
- **Policy version 2 adds three things:**
  - `deny_reads` on the Gubernaut workspace and the other project. APEX's agent memory moves into the first.
  - `git-internals`, which protects `.git/hooks` and `.git/config`.
  - `codex-harness`, which binds Codex alone: AGENTS.md, CLAUDE.md, `.codex/`, `.claude/`, this policy and four gates.

**A false positive, found by using it.** Under the new spellings, a probe that kept its errors (`2>&1`) beside
`$HOME/.codex` was refused. `2>&1` duplicates a stream and writes no file. Two cases were added:
- `2>&1` beside a protected path must be allowed. It failed first.
- `>& file` must still deny. It already did.

Then REDIRECT changed: `>&` followed by a digit or `-` no longer counts as a write.

**After:** 59 of 59.

```
  [PASS]  DENY   bash read of the APEX tree
  [PASS]  DENY   bash read of ~/Work, spelt with a tilde
  [PASS]  DENY   bash read by relative traversal into APEX
  [PASS]  DENY   bash search of another project (Dashy Personal)
  [PASS]  allow  bash read of the Codex config, protected from writes only (must be ALLOWED)
  [PASS]  allow  bash 2>&1 beside a protected path duplicates a stream, writes nothing (must be ALLOWED)
  [PASS]  DENY   bash >& into a protected file still writes it
  [PASS]  DENY   bash rm in the intake drop, by its path relative to the repo
  [PASS]  DENY   bash write of a git hook
  [PASS]  DENY   codex patch adding a file in the APEX tree
  [PASS]  DENY   codex patch to the machine's Codex config
  [PASS]  DENY   codex patch adding a keypair under keys/, by a relative path
  [PASS]  DENY   codex patch moving a file into the intake drop
  [PASS]  DENY   codex patch whose second file is a .env
  [PASS]  DENY   codex patch to AGENTS.md, the law that binds it
  [PASS]  DENY   codex patch to its own hooks
  [PASS]  DENY   codex patch to a gate (session_close.py)
  [PASS]  DENY   codex patch adding a git hook
  [PASS]  allow  codex patch to ordinary Solanaut files (must be ALLOWED)
  [PASS]  allow  codex patch whose text names APEX, to a Solanaut file (must be ALLOWED)
  [PASS]  DENY   codex patch naming no file denies
  [PASS]  DENY   codex patch with no readable text denies
  [PASS]  DENY   codex bash as an argument list, rm in APEX
  [PASS]  DENY   codex bash sed -i on AGENTS.md
  [PASS]  allow  claude editing AGENTS.md: the Codex-only rule must not apply (must be ALLOWED)
  59/59 cases passed
```

The 34 earlier cases all still pass. One of them was reworded: the prose case's commit message now names
`~/.codex`, not `~/Work`. `~/Work` is now never-read, so a mention of it is refused, and the case would no longer test
REDIRECT's prose rule.

**End to end, as Codex's hook calls it.** Eleven Codex-shaped payloads were piped to `/usr/bin/python3
tools/boundary_guard.py --harness codex`, the exact command in `.codex/hooks.json`. Every one gave the expected exit:
- **exit 2, with the reason on stderr:**
  - patches to `.env.hook-probe`, `keys/x.json` and AGENTS.md;
  - `touch .env.hook-probe`;
  - `test -d ~/Lab`;
  - `cat` of a file in APEX;
  - a payload that is not JSON.
- **exit 0:**
  - a patch to `guard.ts`;
  - `npm test 2>&1 | tail`;
  - `git add`, `commit` and `push`;
  - `uv run --script tools/session_close.py`.

The script is in the session's scratchpad. These cases repeat the self-test's shapes.

**Denials now exit 2**, with the reason on stderr and the JSON decision on stdout. Each harness blocks a call on
exit 2. A crash inside the guard is now a denial too: an uncaught exception exits 1, which both harnesses read as
"proceed".

**Command rules** (`.codex/rules/solanaut.rules`), checked with `codex execpolicy check`:
- **forbidden:**
  - `npm publish`;
  - `gh repo edit`, `gh release create`;
  - `git push --force …`;
  - `git remote set-url …`;
  - `solana config set …`;
  - `node tools/colosseum_entry.mjs …`.
- **not matched:** `git push origin main`, `solana airdrop 1 --url devnet`, `npm test`, `git commit`.

The machine-wide rules allow `ssh` and `gh api` unrestricted, for other projects. Here `gh api` could change the
repository's visibility, and the machine's ssh hosts belong to other projects, so the project's rules forbid `gh api`,
`ssh` and `scp`.

Checked against both rule files together, as a session here loads them, all 10 cases came out as expected. The
project's `forbidden` outranks the global `allow`; `npm ci` stays allowed; `gh run list` and a plain push match no
rule.

A prefix rule sees only how a command starts, so `git push origin main --force` is not caught. AGENTS.md states the
rule, and the rules file says so.

**Codex's sandbox** (`.codex/config.toml`), in three steps:
- **Under the default workspace-write settings,** probed with `codex sandbox`:
  - `.git` was read-only, so there could be no commits;
  - the network was off, so no npm, devnet or push;
  - every `uv run --script` gate failed on the read-only uv cache.
- **With the project's values passed as overrides:**
  - `.git` and the caches were writable;
  - the devnet RPC answered 200, and `git ls-remote origin` worked.
- **What a session in this folder loads,** rendered by `codex debug prompt-input` without calling a model:
  - `workspace-write`, with "Network access is enabled";
  - exactly the writable roots the file lists.

`codex sandbox` itself does not read the project layer: run bare, it showed the defaults.

**Found, and not fixable from here.** That rendering also shows Codex loading six of Gubernaut's skills machine-wide,
from `~/.agents/skills`: `astro-component`, `claims-check`, `copy-draft`, `gate-run`, `receipt-write` and `token-apply`.
Switching them off in the project's config was tried in both TOML forms, and Codex ignored both. The same value
passed as a `-c` override did remove them. So AGENTS.md names them as never to be used here, and the run record states
the machine-level change for the human. The ineffective setting was removed rather than left in place looking as if it
worked.

**Not proven here:** that a live Codex session fires the hook. That needs Codex running, which this session does not
start. The handoff prompt's first step is that probe. A patch to `.env.hook-probe`, and the shell command `touch
.env.hook-probe`, must each be refused. If either file appears, Codex deletes it and stops.
