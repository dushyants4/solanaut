# CLAUDE.md — Solanaut

**A transaction firewall for Solana AI agents.** A deterministic policy decides what an agent may
sign at all, and an open-source control loop, Gubernaut Keel, stops retry loops and fee
escalation. It is built for Colosseum's Crypto World's Fair hackathon (submissions close
**2026-10-12, 11:59pm PT**) and runs on **devnet**. One capped, human-run mainnet canary with a Phantom wallet is
proposed (`design/ADR-008-mainnet-canary.md`) and **deferred**: on 2026-09-30 the human chose devnet only for now.

This file is the root router and the law. It points at detail rather than copying it. Read it
first, every session.

---

## What this project is, and is not

| Solanaut is | Solanaut is not |
|---|---|
| its own project, with its own repo, agent, memory and history | part of the Gubernaut workspace (APEX), or a place to change Gubernaut |
| a consumer of `@gubernaut/core` (Keel) from npm, pinned and digest-checked | a fork of Gubernaut's code, or a copy of its private records |
| a devnet product with test SOL; a capped, human-run mainnet canary is proposed (ADR-008) and deferred by the human | a mainnet vault for anyone's funds, a pay-to-attack game, a public challenge, or a real-funds key in this tree |
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
- **Private material the human opens explicitly** (a private workspace, a confidential document) is
  read-only, for that session. Notes on it go in `kb/private/` (gitignored), and nothing committed
  cites, quotes or names it. A lesson from it enters a committed file only in Solanaut's own words,
  with a public source (`design/ADR-007-knowledge-vault.md`).

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
(gitignored), made with `solana-keygen`, never written by an agent's Write tool. If the human accepts ADR-008, the
canary's agent key is made by the human outside this tree; no agent reads it, and every real-funds step is the
human's (T4).

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

**Plan mode** writes plans to `docs/plans/` (`"plansDirectory"` in `.claude/settings.json`). The default,
`~/.claude/plans/`, is denied by the boundary guard.

## Build, run, test

```bash
npm install                         # dependencies (npm workspaces)
npm test                            # the guard's evals (node:test, TypeScript run natively)
npm run typecheck                   # tsc 7, no emit
npm run sandbox                     # the plugin sandbox, offline: three scenarios through the guard
npm run validator                   # a local solana-test-validator (ledger in .sandbox/)
npm run sandbox -- --cluster local  # the same scenarios on the validator: allowed txs land, denied ones are never sent
npm run doctor                      # the toolchain against TOOLCHAIN.md
npm run pin-table -- --url <rpc> <table>         # a lookup table's pin for the policy
npm run replay -- <record.jsonl> <policy.json>   # recompute a guard's record; exit 1 at the first divergence
npm run cockpit -- --record <r> --policy <p> [--rpc <url> --squads <f>] --port 8790   # the dashboard, on 127.0.0.1
node apps/onchain/src/squads.ts --url <rpc> --operator keys/devnet-operator.json --agent keys/devnet-agent.json \
  --treasury keys/devnet-treasury.json [--multisig <pda> [--limit <pda>]] [--keep --out <f>]   # the stolen-key drill
node apps/onchain/src/scenes.ts --url <rpc> --agent keys/devnet-agent.json --operator keys/devnet-operator.json \
  --treasury <pubkey> --dir .sandbox/devnet                                  # DEMO.md's scenes, end to end
uv run --script tools/boundary_guard.py --selftest   # the write boundary, 34 cases
uv run --script tools/kb_lint.py                     # the knowledge vault: links, notes, registers
uv run --script tools/claims_lint.py                 # every measured claim names its command, receipt and date
uv run --script tools/session_close.py               # every gate, before closing
node tools/colosseum_entry.mjs inspect               # read the Colosseum page in the human's Chrome
```

`tools/colosseum_entry.mjs` drives a Chrome the human started and logged into
(`--user-data-dir=~/.cache/solanaut/chrome --remote-debugging-port=9333`). It refuses any click
that creates, saves or submits unless passed `--confirmed`, which is passed only after the human
approves the exact text on screen.

Toolchain and pins: `TOOLCHAIN.md` (Node 26.7.0, Agave 3.1.10, Anchor 1.2.0). v1 transactions need a local
validator from Agave 4.2.2, run by its absolute path, never by switching the active release.

## Architecture

```
agent ── proposes bytes ──▶ @solanaut/sdk  guard.check()          propose → admit → sign (ADR-004)
   decode   (legacy; v0 with pinned lookup tables; v1 from its config; unknown → DENY)    ADR-009, built (2a.2)
   classify (an allowlist per instruction; durable nonces and other signers → DENY)       ADR-009, built (2a.3)
   policy   (principal, programs, destinations, mints, per-tx, per-window and fee caps)   → DENY, whatever the model says
   intents  (keyed by effects: no re-sign while an earlier attempt could still land, or may have landed unreported)  built (2a.5; D14)
   sensor   (proposal stream → intensity, valence, repetition)                            v1, measured (2a.7)
   Keel     (@gubernaut/core 1.0.1; wasm and module hashed; telemetry checked first)       → REGROUND → DENY; posture only restricts
   receipt  (message hash, expiry, policy hash) → signer · the log is the state (ADR-010; a synced, locked file, restored by replay) · any error → DENY
on-chain (devnet, achieved at 2a.9): a Squads v4 spending limit naming the agent's key bounds a stolen key (ADR-006)
operator: a Phantom wallet, the Squads config authority and latch release · dashboard: read-only, no keys (ADR-011)
```

Today's code implements `guard.check(proposal)`: message bytes in, rules 0 to 19 in order, a hash-chained record,
receipts, intents and the latch, a durable record restored by replay, sensor v1 and a byte-verified Keel. Every
defect in `docs/SPEC.md` §10 is closed; what remains is specified there. Each milestone's receipt is in `evals/`.

**The roadmap is milestones, not dates.** `docs/ROADMAP.md` is the five-leg parlay: each milestone is reached when
its gate passes, with its evidence, never by a calendar. `PROGRESS.md` shows where it stands, and
`docs/READINESS.md` says what a certified release needs. The contest deadline is an external fact: the human submits
whatever has passed its gate.

| Path | What |
|---|---|
| `packages/sdk/` | the guard: `message.ts` (bytes), `classify.ts` (effects), `policy.ts`, `guard.ts` (the rules, replay), `state.ts`, `log.ts` and `record.ts` (the record), `latch.ts`, `sensor.ts`; `adapters/` (Solana Agent Kit, kit, RPC); `bin/pin-table.ts`, `bin/replay.ts` |
| `apps/sandbox/` | the plugin sandbox |
| `apps/cockpit/` | the dashboard (milestone 2a.10): read-only, localhost only, reads the record and the chain, holds no keys (ADR-011) |
| `apps/onchain/` | devnet scripts: `squads.ts`, the Squads v4 spending-limit drill (milestone 2a.9); `scenes.ts`, DEMO.md's scenes end to end through `guardedWallet`, with a real SIGKILL and restore (2b.1, 2b.3) |
| `apps/agentkit/` | validation: a scripted Solana Agent Kit agent behind `guardedWallet` (milestone 2b.3) |
| `programs/` | *(Alpha, milestone 3.7)* `solanaut_anchor`: anchors the decision log's head. On-chain caps come from composing Squads v4 (ADR-006) |
| `docs/` | `PRODUCT.md` (why, what, how) · `ROADMAP.md` (the milestones) · `READINESS.md` (to a certified release) · `RISKS.md` (the risk register) · `OVERVIEW.md` (the code as it is) · `SPEC.md` (the MVP baseline) · `ARCHITECTURE.md` (long term) · `HACKATHON.md` (the contest's rules) · `CLAIMS.md` · `papers/` · `submission/` · `plans/` |
| `design/` | ADRs 001–014; ADR-008 is proposed and deferred: devnet only for now; ADR-012 (when REGROUND latches), ADR-013 (the signer process) and ADR-014 (the operator-signed policy) are proposed for the human |
| `plugins/` `workflows/` `tools/` | the office: seats, SOPs, deterministic gates |
| `kb/` | the knowledge vault (ADR-007): `INDEX.md` (front page), `LOG.md`, `DOCUMENTS.md` (the paper register), `REGISTRY.md` (upstream pins), `sources/`, `wiki/`, `milestones/`, `templates/`, `intake/`, and `private/` (gitignored) |
| `evals/` | receipts: every gate shown failing, then passing |
| `runs/` | one record per session, `YYYY-MM-DD-<slug>.md` |
| `.obsidian/` | the vault's shared settings. Open this folder in Obsidian; per-user state is gitignored |
| `Docs-Dashy-Drop/` | the human's drop and the vault's raw inbox. **Read-only**, byte for byte; triaged in `kb/intake/` |

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

When a phase in `PROGRESS.md` ends, also close it into the knowledge base with
`workflows/milestone_review.md` (`/milestone`): the review, the compiled knowledge, the registers, and
a `milestone/<id>` tag.
