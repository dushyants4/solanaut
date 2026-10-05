# AGENTS.md — Solanaut, for Codex

> For Codex, which develops Solanaut from 2026-10-05 until the human hands the work back to Claude. Written by the
> Claude session that built the Beta, at the human's request. `CLAUDE.md` is the project's law, written for Claude
> Code. This file is the same law for Codex, and says what changes where the two harnesses differ. **You cannot edit
> this file, `CLAUDE.md`, `.codex/`, `.claude/`, the boundary policy or the gates**: the boundary guard refuses it. When
> one of them needs to change, write the exact edit in your run record and in `docs/HANDOFF.md` §6.

## What Solanaut is

A transaction firewall for Solana AI agents. A deterministic policy decides what an agent may sign at all, and an
open-source control loop, Gubernaut Keel (`@gubernaut/core` from npm), stops retry loops and fee escalation. It was
built for Colosseum's hackathon, and runs on **devnet** only.

| Solanaut is | Solanaut is not |
|---|---|
| its own project, with its own repo, agents and history | part of the Gubernaut workspace (APEX), or a place to change Gubernaut |
| a consumer of `@gubernaut/core` 1.0.1, pinned and digest-checked | a fork of Gubernaut, or a copy of its private records |
| a devnet product with test SOL | a mainnet vault, a pay-to-attack game, or a home for any real-funds key |
| honest about limits: the policy stops drains, the loop stops loops | "un-hackable", "injection-proof", "100% blocked" (`docs/CLAIMS.md`) |

## Read first, every session, in this order

1. This file.
2. `docs/HANDOFF.md`: the state at the transfer, the human's decisions, **your work queue**, the lessons that will
   bite, your log, and how to hand back.
3. `PROGRESS.md`: where every milestone stands.
4. For the item you are on: its milestone in `docs/ROADMAP.md` (Leg 3), its requirements by ID in `docs/SPEC.md` §13,
   and its ADR in `design/`.
5. `docs/READINESS.md` for the thresholds, `docs/RISKS.md`, and `docs/CLAIMS.md` before you write any number.
6. `CLAUDE.md`, for anything this file does not cover. Where they differ, this file governs Codex.

Then run `git fetch && git status`.

## The law

These do not bend for a deadline, a passing test, or a plausible reason.

1. **Isolation.** Never read or write the Gubernaut workspace (`/home/dashy/Projects/A - Gubernaut Project - APEX`),
   `~/Work`, `~/Lab`, `~/Projects/Dashy Personal`, or another project's agent memory. Do not name them in a command,
   even to search: the guard refuses it.
   - Gubernaut is reached only through its published npm package and its public pages, cited by URL. Its `gub`
     control plane is never used here.
   - If a Gubernaut package looks wrong, write the finding in `runs/` for the human. Never work round it.
2. **Machine-wide config is the human's.** Never change any of these; state the exact change for the human instead:
   - `~/.codex/`, `~/.claude/`, `~/.agents/`;
   - shell profiles and global npm;
   - the Solana CLI's global config. Pass `--url` and `--keypair` on every command.
3. **Another project's skills.** Six skills load machine-wide from `~/.agents/skills` and belong to Gubernaut:
   `astro-component`, `claims-check`, `copy-draft`, `gate-run`, `receipt-write`, `token-apply`. Never use them here.
   Solanaut's claims rules are `docs/CLAIMS.md` and `tools/claims_lint.py`.
4. **Keys.** No key that holds real funds ever lives in this tree. Devnet keys live in `keys/` (gitignored) and are
   made only with `solana-keygen`.
   - Never print, `cat`, copy or paste a key file's contents: pass keys by path.
   - Secrets come from the environment, never from a file, a log, a reply or a commit.
5. **Devnet only.** No mainnet transaction, ever: ADR-008, the mainnet canary, is deferred by the human. Reading public
   mainnet data moves no funds and is allowed: blocks for differential decoding, or a Surfpool fork.
6. **Tier T4 is the human's, every time:**
   - publishing a package;
   - mainnet or real funds;
   - making the repository public;
   - the Colosseum page and submission;
   - posting anywhere;
   - the licence, and the judges' access.

   `.codex/rules/solanaut.rules` refuses the common forms. The rest is your discipline.
7. **Claims.** Every public sentence about Solanaut or Gubernaut traces to a `docs/CLAIMS.md` row; a number not there
   is not said. Gubernaut's figures are quoted as "Gubernaut reports …", with their scope. A new measured number gets a
   row with its regenerating command, its receipt in `evals/` and its date. `claims_lint` enforces this.
8. **Read-only.** `Docs-Dashy-Drop/` is the human's drop: read-only, byte for byte. `kb/private/` is never cited.
9. **Gates.**
   - No gate is weakened to pass.
   - No threshold in `docs/READINESS.md` is lowered without the human.
   - No coefficient is tuned after looking at a battery's result; a change of definition is re-run on fresh seeds.
   - A failing gate is a finding, recorded at the same size as a pass.

## Tiers: how expensive it is to be wrong

| Tier | What moves | Gate |
|---|---|---|
| T0 · Read | nothing | none |
| T1 · Draft | docs, `kb/`, `runs/`, drafts | the seat's workflow |
| T2 · Build | product code: `packages/`, `apps/`, `programs/` | tests and typecheck green, diff read |
| T3 · Gate | the guard's rules, the doctor, the claims list, the evals, the public SDK surface | **the gate shown failing on an injected fault first** |
| T3s · Sync | commit and push to the private `origin` | gates green; a standing grant |
| T4 · Publish | mainnet, real funds, making the repo public, the submission, posting anywhere, a package publish | **the human, at the moment, every time** |

## How Codex is fenced here, and what to do when the fence holds

- **`.codex/hooks.json`** runs `tools/boundary_guard.py --harness codex` before every shell command and every
  `apply_patch`.
  - A refusal starts with `BOUNDARY GUARD`. Never retry it by another route: a variable, an interpreter, `cd`, or
    another spelling.
  - Most refusals are the heuristic seeing a protected path beside a mutating word. Edit files with `apply_patch`,
    which the guard checks exactly. Keep protected paths out of shell commands, commit messages and test strings, or
    split the command.
  - If **every** call is refused with `(fail-closed)`, the policy itself is broken: stop and tell the human.
  - The limits are listed in `uv run --script tools/boundary_guard.py --explain`.
- **`.codex/config.toml`** sets a workspace-write sandbox, with the network on. You can write in this folder, `.git`,
  `/tmp` and the uv, npm, Solana and Cargo caches.
  - To write anywhere else, for instance to install a tool, ask for approval with the exact command and why. Never use
    another route.
  - A toolchain change also updates `TOOLCHAIN.md`.
- **`.codex/rules/solanaut.rules`** forbids the common T4 commands, plus `ssh`, `scp` and `gh api`. Read CI with
  `gh run list` and `gh run view`.

## The seven seats

A seat is a write boundary, not a person. You wear each in turn. Each seat's full instructions are in
`plugins/<seat>/agents/<seat>.md`; read the one you are about to act as.

| Seat | Writes | Never writes | Its question |
|---|---|---|---|
| **architect** | `design/`: ADRs, topology | implementation code | What shape should this system be, and what is the evidence? |
| **builder** | `packages/`, `apps/`, `programs/`: implementation, refactors | design docs, evals | Does it work, and does it read like the code around it? |
| **evaluator** | `evals/`, test batteries | any fix for what it finds | Does it actually pass, on a case that could fail? |
| **integrator** | the public API surface, packaging, consumer docs | internals | Can someone outside this repo use it without asking? |
| **operator** | CI config, containers, release scripts | product code, evals | Will it come up clean on a machine that isn't mine? |
| **archivist** | `runs/`, `PROGRESS.md`, `kb/` | source of any kind | What happened, and what is owed? |
| **harness** | `.claude/`, `.codex/`, `CLAUDE.md`, `AGENTS.md` | product code | **Not Codex's:** owed edits go in `docs/HANDOFF.md` §6 |

The order within a milestone is architect, builder, evaluator, integrator, operator, archivist. Act as architect only
when a choice falls outside the accepted ADRs. Then write a **proposed** ADR, add the question to `docs/HANDOFF.md` §5,
and move to other work; do not build on a proposal. Tests you write for your own code are not independent evidence,
and receipts say so. The Alpha's independent red team (RT-2) is Claude's, on return.

## How to build a queue item

1. **Choose.** Take the next item in `docs/HANDOFF.md` §4 whose dependencies are achieved.
2. **Read.** Read its requirement IDs in `docs/SPEC.md` §13 and its ADR.
   - Something unspecified that is reversible and inside the ADR: decide it, and record the decision in the run record
     and in `docs/SPEC.md`.
   - Anything that changes an accepted ADR or a threshold: stop that item, write the question in `docs/HANDOFF.md` §5,
     and take the next item.
3. **Tests first.** At least one per requirement ID, named by the ID. Run them and see each fail for the right reason,
   then save that output for the receipt.
4. **Build to the tests.** Match the code around it:
   - TypeScript run natively by Node 26, with no build step; ESM; `node:test`; `@solana/kit`; never
     `@solana/web3.js`;
   - small functions;
   - a comment where the code cannot say why.
5. **Plant faults.** Break the new code on purpose in several places. Confirm a test catches each, then revert.
   Record each caught and missed fault: a miss means a test to add.
6. **Write the receipt** in `evals/<area>/<name>.md`: what failed first, what passes now, the planted faults, the
   numbers, and the command that regenerates each. Then add its row to `evals/README.md`.
7. **Claims and documents:**
   - a new measured number gets its `docs/CLAIMS.md` row;
   - update `docs/SPEC.md` (decisions, defects), `docs/OVERVIEW.md` if the code's shape changed, `docs/RISKS.md`, and
     `kb/DOCUMENTS.md` for every document changed.
8. **Gates.** `npm test`, `npm run typecheck` and `uv run --script tools/session_close.py --slug <slug>`. The push and
   clean-tree gates turn green after step 9.
9. **Commit and push.** One coherent step per commit, with a message in the form `<area>: <what>, <how it was
   verified>`, ending with the trailer `Agent: Codex (<model>, <reasoning effort>)`, so the history shows who wrote
   what and with which settings. Then check CI with `timeout 60 gh run list --limit 3`. On 2026-10-05 `gh` hung on
   every command, while `git push` worked: if it times out, write "CI not read: gh timed out" in the run record and go
   on. Never read its token another way.
10. **Log it.** Add a row to `docs/HANDOFF.md` §7. When a milestone's gate passes with its evidence, mark it in
    `PROGRESS.md`.

## Long runs

- **The repository is the memory.** A context window is not. Commit and push after every queue step, and before
  anything long. Nothing durable goes in `/tmp`, which is cleared on reboot: scratch goes in `.sandbox/`, which is
  gitignored.
- **One run record per session**, `runs/YYYY-MM-DD-codex-<slug>.md`, in the template of `workflows/session_close.md`.
  Write it as you go, not at the end. Its `Found` section carries failures.
- **Long processes**, such as a validator or a soak run, go in the background. Log them under `.sandbox/`, note the
  PID, and stop them before the session ends.
- **The public devnet RPC rate-limits, and its faucet refuses** (RK16). Back off on reads, and never retry a send. When
  the run needs devnet SOL, add "fund `<pubkey>` with N devnet SOL" to `docs/HANDOFF.md` §5 and take another item.
- **Blocked on the human:** write it in §5 and take the next unblocked item. Never idle, and never guess past a decision
  that is the human's.

## Commands

```bash
npm ci                                  # dependencies, from the lockfile
npm test                                # node --test over packages/sdk/test and apps/*/test (globs; Node 26)
npm run typecheck                       # tsc 7, no emit
npm run sandbox                         # three scenarios through the guard, offline
npm run validator                       # a local solana-test-validator, ledger in .sandbox/
npm run doctor                          # the toolchain against TOOLCHAIN.md
npm run replay -- <record.jsonl> <policy.json>   # recompute a guard's record; exit 1 at the first divergence
uv run --script tools/boundary_guard.py --selftest
uv run --script tools/kb_lint.py
uv run --script tools/claims_lint.py
uv run --script tools/session_close.py --slug <slug>
```

The pins are in `TOOLCHAIN.md`: Node 26.7.0, Agave 3.1.10, Anchor 1.2.0. Never switch the active Solana release.
v1 transactions need Agave 4.2.2's validator, run by its absolute path.

## Stop and ask the human

- A step is T4, or would touch real funds or mainnet.
- A gate fails, and the only fix would weaken it, or a threshold cannot be met. Leg 3 then busts at that milestone:
  record it, and never paper over it.
- An accepted ADR turns out wrong or incomplete.
- The boundary guard fails closed on everything, or the probe in `docs/HANDOFF.md` §4 item 0 fails.
- A secret or a key appears where it should not be.
- A push fails and you cannot say why.

## Handing back to Claude

When the human says so, or when every item left needs the human or Claude, follow `docs/HANDOFF.md` §8. Claude
returns to:
- review the work;
- run the independent red team on code it did not write;
- write the Alpha's milestone review;
- apply the owed edits to the files you could not change.

## Style

- **Code** reads like the code around it. The density and the naming of its comments match.
- **Documents** are plain and short, in British spelling, as the rest of this repository is.
  - Every number carries its scope, and "measured" is never written where "specified" is meant.
  - Nothing is called done until its evidence is in `evals/` or `runs/`.
