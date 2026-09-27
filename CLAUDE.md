# CLAUDE.md — Solanaut

**A transaction firewall for Solana AI agents.** A deterministic policy decides what an agent may
sign at all, and an open-source control loop, Gubernaut Keel, stops retry loops and fee
escalation. It is built for Colosseum's Crypto World's Fair hackathon (submissions close
**2026-10-12, 11:59pm PT**) and runs on **devnet only**.

This file is the root router and the law. It points at detail rather than copying it. Read it
first, every session.

---

## What this project is, and is not

| Solanaut is | Solanaut is not |
|---|---|
| its own project, with its own repo, agent, memory and history | part of the Gubernaut workspace (APEX), or a place to change Gubernaut |
| a consumer of `@gubernaut/core` (Keel) from npm, pinned and digest-checked | a fork of Gubernaut's code, or a copy of its private records |
| a devnet demo with test SOL | a mainnet vault, a pay-to-attack game, or anything holding real funds |
| honest about limits: the policy stops drains; the loop stops loops | "un-hackable", "injection-proof", "100% blocked": see `docs/CLAIMS.md` |

## Isolation — the rule this project exists under

Solanaut was split out of the Gubernaut workspace and must never bleed into it, or it into this.

- **Never read or write the Gubernaut workspace**: `/home/dashy/Projects/A - Gubernaut Project -
  APEX`, `~/Work/`, `~/Lab/`. Reads are denied in `.claude/settings.json`; writes are denied by
  the boundary guard. Gubernaut is reached only through its **published** packages and **public**
  pages (github.com/thegubernaut, gubernaut.com), cited by URL.
- **Never change machine-wide agent config** (`~/.claude/settings.json`, skills, hooks, plugins,
  plans; `~/.codex/`). State the exact change for the human instead.
- **The 30 Gubernaut plugins enabled machine-wide are switched off here** (`.claude/settings.json`).
  Only the seven `solanaut-*` seats load.
- **Never touch the Solana CLI's global config.** Pass `--url` and `--keypair` explicitly.
- If a Gubernaut package looks wrong, write the finding in `runs/` for the human. Do not work
  around it silently and do not edit it.

**Enforced, not described:** `tools/boundary_guard.py` runs on every Write, Edit and Bash call
(`.claude/settings.json`), against `plugins/harness/hooks/boundaries.toml`. It fails closed. Its
limits are in `uv run --script tools/boundary_guard.py --explain`.

## Tiers — how expensive it is to be wrong

| Tier | What moves | Gate |
|---|---|---|
| **T0 · Read** | nothing | none |
| **T1 · Draft** | docs, `kb/`, `runs/`, drafts | the seat's workflow |
| **T2 · Build** | product code: `packages/`, `apps/`, `programs/` | tests and typecheck green, diff read |
| **T3 · Gate** | the guard, the doctor, the claims list, the evals, the public SDK surface | **the gate shown failing on an injected fault first** |
| **T3s · Sync** | commit and push to the **private** `origin` | gates green; standing grant |
| **T4 · Publish** | mainnet, real funds, making the repo public, the Colosseum submission, posting anywhere, a package publish | **the human, at the moment, every time** |

**No key that holds real funds ever lives in this tree.** Devnet keys live in `keys/`
(gitignored), made with `solana-keygen`, never written by an agent's Write tool.

## The seven seats

A seat is a write boundary, not a folder. Each is a plugin in `plugins/`, vendored from the
Office pattern (`plugins/VENDORED.md`). `tools/scaffold.py` holds the table the manifests are
generated from; this copy is for reading.

| Seat | Model | Writes | Never writes | Its question |
|---|---|---|---|---|
| **architect** | opus | design/ — ADRs, topology, context strategy | implementation code | What shape should this system be, and what is the evidence? |
| **harness** | sonnet | .claude/ assets and CLAUDE.md files | product code | What does the agent need in its environment to get this right? |
| **builder** | sonnet | src/, implementation, refactors | design docs, evals | Does it work, and does it read like the code around it? |
| **integrator** | sonnet | public API surface, packaging, consumer docs | internals | Can someone outside this repo use it without asking me? |
| **evaluator** | opus | evals/ and test batteries — nothing else | any fix for what it finds | Does it actually pass, on a case that could fail? |
| **operator** | sonnet | CI config, containers, release scripts | product code, evals | Will it come up clean on a machine that isn't mine? |
| **archivist** | haiku | runs/, PROGRESS.md, kb/ | source of any kind | What happened, and what is owed? |

**The evaluator writes nothing it can fix** (`disallowedTools` in its frontmatter).
Order: architect → builder → evaluator → integrator → operator → archivist.

## Running the dedicated agent

Solanaut is operated from its own root, by its own session. Never from the APEX session.

```bash
cd ~/Projects/Solanaut && claude          # a terminal session
```

Or open **this folder** in VS Code (*File → Open Folder*), in its own window. Do not add it to
the APEX `.code-workspace`. First open: Claude Code offers to install the `solanaut-office`
marketplace declared in `.claude/settings.json`; accept it for this project only.

Workers: Codex may run here as `codex exec -C ~/Projects/Solanaut …` (this folder has its own
trust entry). Gubernaut's `gub` control plane is **not** used here; it belongs to APEX.

## Build, run, test

```bash
npm install                         # dependencies (npm workspaces)
npm test                            # the guard's evals (node:test, TypeScript run natively)
npm run typecheck                   # tsc 7, no emit
npm run sandbox                     # the plugin sandbox, offline: three scenarios through the guard
npm run validator                   # a local solana-test-validator (ledger in .sandbox/)
npm run sandbox -- --cluster local  # the same scenarios on the validator: allowed txs land, denied ones are never sent
npm run doctor                      # the toolchain against TOOLCHAIN.md
uv run --script tools/boundary_guard.py --selftest   # the write boundary, 34 cases
uv run --script tools/session_close.py               # every gate, before closing
```

Toolchain and pins: `TOOLCHAIN.md` (Node 26.7.0, Agave 3.1.10, Anchor 1.2.0).

## Architecture

```
agent ── proposes tx ──▶ @solanaut/sdk  guard.evaluate(proposal)
   policy  (program + destination allowlists, per-tx and per-window caps)  → DENY, whatever the model says
   sensor  (proposal stream → intensity, valence, repetition)            → v0, unmeasured
   Keel    (@gubernaut/core 1.0.1, wasm digest checked at startup)      → REGROUND → DENY
   any error → DENY (fail closed)
```

| Path | What |
|---|---|
| `packages/sdk/` | the guard: `policy.ts`, `sensor.ts`, `guard.ts`, `describe.ts` (web3.js tx → proposal) |
| `apps/sandbox/` | the plugin sandbox |
| `programs/` | *(H3)* the Anchor vault: program-enforced caps and allowlist, decision events |
| `docs/` | `ARCHITECTURE.md` (long term) · `HACKATHON.md` (scope, dates, rules) · `CLAIMS.md` · `plans/` |
| `design/` | ADRs |
| `plugins/` `workflows/` `tools/` | the office: seats, SOPs, deterministic gates |
| `kb/` | intake records and upstream pins (`REGISTRY.md`) |
| `evals/` | receipts: every gate shown failing, then passing |
| `runs/` | one record per session, `YYYY-MM-DD-<slug>.md` |
| `Docs-Dashy-Drop/` | the human's drop. **Read-only**, byte for byte; triaged in `kb/intake/` |

## Claims

**Every public sentence about Solanaut or Gubernaut traces to `docs/CLAIMS.md`.** Gubernaut's
figures are quoted as "Gubernaut reports …", with their scope, never as Solanaut's own. A number
that is not there is not said. The drop documents contain several claims that must not be
repeated; `docs/CLAIMS.md` lists each one and why.

## Standing rules

1. Start with `git fetch && git status`.
2. Stay in your seat's boundary; state the exact edit for anything outside it.
3. Secrets come from the environment, never a file, a log or a reply.
4. If a step can be a script, make it a script.
5. A checker that cannot see must fail loudly, never report clean.
6. Ask rather than assume. A plausible answer is worse than a question.
7. Synchronise at every milestone: commit, push `origin`. Work only on this disk has not happened.
8. Nothing goes public, gets submitted, or touches real funds without the human.

## Close every session

`workflows/session_close.md`: write `runs/YYYY-MM-DD-<slug>.md` and update `PROGRESS.md`, then
run `tools/session_close.py` until it is green, then commit and push.
