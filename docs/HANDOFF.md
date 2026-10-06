# HANDOFF.md — Claude to Codex, and back

> **Draft 1** · 2026-10-05 · from Claude, the session that built and verified the Beta, to Codex · for: Codex, the
> human, and Claude on its return · not public. The rules Codex works under: `AGENTS.md`. Register:
> `kb/DOCUMENTS.md`. Codex keeps §5, §6 and §7 current; everything else changes only when the human or Claude says so.

## 1. Where Solanaut stands at the transfer

- **Legs 1 and 2 are won.** The Beta MVP is built, verified and validated on devnet.
  - The human signed off its review on 2026-10-05 (`kb/milestones/2026-10-01_2b-beta.md`), and the commit carrying the
    sign-off is tagged `milestone/beta`.
  - The Alpha's scope (milestone 2c.1) is approved: `docs/SPEC.md` §13, ADR-013 to ADR-018, `docs/RISKS.md` 1.0, and the
    thresholds in `docs/READINESS.md` 2.0.
- **The guard, `packages/sdk`, decides in this order:**
  - it decodes legacy, v0 with pinned lookup tables, and v1 messages, denying an unknown version;
  - it classifies each instruction against an allowlist;
  - it applies rules 0 to 19 in order, with receipts and intents keyed by effects;
  - a latch stops it until the operator signs an ed25519 release;
  - Keel, its bytes hashed, reads sensor v1's numbers.

  The log is the state: a hash-chained record, synced before each answer and restored by replay.
- **Around it:**
  - adapters for Solana Agent Kit (`guardedWallet`) and kit (`guardedSigner`);
  - a Squads v4 spending limit on devnet, which bounds a stolen key;
  - a read-only cockpit on localhost;
  - the demo's scenes, run end to end on devnet.
- **Measured** (`PROGRESS.md`, `evals/README.md`):
  - `npm test` passes 161 of 161, and the typecheck is clean;
  - the boundary guard passes 59 of 59;
  - `kb_lint` and `claims_lint` report no errors;
  - CI is green;
  - defects D1 to D20 are all closed;
  - the independent evaluator run: 317 cases, and six defects closed test-first.
- **Still open in `docs/SPEC.md` §12**, for milestone 3.10 (RT-3): runs of failed outcomes, and loops that alternate
  shapes.

## 2. The human's decisions, and the standing ones

| When | Decision |
|---|---|
| 2026-09-30 | Devnet only. ADR-008, a capped mainnet canary, is deferred. Milestones, not dates. |
| 2026-09-30 | The licence, the judges' access and the Colosseum submission are set aside until testing is done. The submission window closes 2026-10-12, 11:59pm PT; whether to submit, and what, is the human's (T4). |
| 2026-10-01 | Outside agent CLIs are not run unattended from Claude's session. The human runs Codex here directly. |
| 2026-10-05 | The Beta review is signed off. The Alpha's scope is approved as drafted. ADR-012's option C is accepted. Leg 3 is handed to Codex. |

## 3. What Codex owns, and what it does not

| Codex owns | Not Codex's |
|---|---|
| building ADR-012 and milestones 3.1 to 3.9, test-first, each with its receipt | T4, every time (`AGENTS.md`) |
| measuring the Leg 3 thresholds (RT-1), and the loop battery for §12's questions (RT-3), proposing what the measurements show | RT-2, the independent red team: Codex builds the code, so Claude runs it on return |
| keeping `PROGRESS.md`, `docs/`, `evals/`, `kb/` and `runs/` true to the code | the Alpha's milestone review and the `milestone/alpha` tag: Claude, then the human |
| proposing an ADR when a choice falls outside the accepted ones | accepting an ADR, or changing a threshold: the human |
| | editing `AGENTS.md`, `CLAUDE.md`, `.codex/`, `.claude/`, the boundary policy or the gates: owed edits, §6 |

## 4. The work queue, in order

**Solanaut 1.0 mission, approved in this session on 2026-10-05:**
`docs/plans/2026-10-05_solanaut-1.md` extends this queue through individual Linux/devnet deployment
and all existing R.1–R.5 gates. The original repository is the eventual public repository.
A release-only JavaScript/declaration build is authorised; native TypeScript development remains.
Allocate snapshots, exclusive recovery, compatibility and lifecycle work before qualification.
Independent packaging and gate preparation can progress while architecture proposals await
acceptance. Mainnet and every T4 action remain separately human-owned.

Take the first item whose dependencies are achieved. Item 0 comes first, every session. The order puts first what
the demo and every later milestone lean on. The ADRs give the design, and `docs/SPEC.md` §13 the requirement IDs that
the tests are named by.

**0. Probe the fence, every session, before any other work.**
- **The patch probe.** Use `apply_patch` to create a file named `.env.hook-probe`. The tool must be refused with
  `BOUNDARY GUARD`.
- **The shell probe.** Run `touch .env.hook-probe`. It must be refused the same way.
- **If either file appears**, the hook is not running. Delete the file, stop, and tell the human: nothing else is safe.
- **Then record the baseline** in the run record:
  - `npm test` (161 at the transfer);
  - `npm run typecheck`;
  - `uv run --script tools/session_close.py`. Gates 6, 8 and 9 may read red until the session's record is written and
    pushed.

**1. ADR-012, option C: when REGROUND latches.** `design/ADR-012-latch-on-reground.md` is the specification.
- **The rule.** A denial at REGROUND latches the guard only when Keel is the reason (rule 17, `loop-reground`), or when
  the denial just before it was also at REGROUND. The run of denials latches as today.
- **"The denial before it"** is read from the record (the previous decision's `allow` and `posture`), so restore and
  replay rebuild it. Nothing new is stored.
- **Tests first:**
  - one REGROUND on an already-denied proposal does not latch;
  - two in a row do;
  - the streams of `evals/sdk/latch-variants.md` become a test that reproduces its table for option C.
- **Records made under today's rule** may not replay at the decision where they differ. The ADR accepts this as a
  one-time break. Say so in the receipt, and name each local or devnet record that stops replaying.
- **Then re-run DEMO.md's scenes on devnet** (`apps/onchain/src/scenes.ts`): scene 5 must no longer latch.
  - Withdraw S12's note that it does, in `docs/CLAIMS.md`, with the new receipt.
  - The keys hold little devnet SOL (§5): if the run cannot be funded, record the offline result, queue the funding,
    and move on.

**2. 3.1 · The signer process.** SIG-1 to SIG-11; ADR-013. This is the foundation of the rest of Leg 3.
- **Clarification accepted:** ADR-019 governs durable request lifecycle, exclusive ownership,
  snapshots, evaluator versions and RPC trust. The human accepted it after review.
- **The same-user mode is what you build and test.** Running it as its own OS user needs a user created with `sudo`,
  which is the human's (§5).
- **SIG-11 is a budget:** state the line count before writing, and measure it after.

**3. 3.2 · The operator-signed policy.** POL-1 to POL-5; ADR-014. Depends on 3.1.
- **Watch replay across a policy change** (POL-4).
- **ADR-012 left one decision for here:** whether records name the rules that made them. A record made under an older
  rule then replays under that rule, not today's. Decide it with POL-4's `policy` entry. If it needs more than ADR-014
  says, propose an ADR (§5).

**4. 3.3 · Token-2022 and token accounts.** TOK-1 to TOK-5; ADR-016. Depends on 3.1. Read
`kb/sources/` on Token-2022's authorities and the transfer-hook guide first.

**5. 3.9 · CI hardened.** CI-1 and CI-2. Depends only on 2a.1, so it can be done between any of the others.
- **The `bite` job** re-runs every gate's fault injection on every push.
- **Then the gates in `docs/READINESS.md`**, each seen failing first:
  - coverage, with the per-file branch floors;
  - StrykerJS mutation on the decoder and the policy;
  - fast-check properties, 10,000 runs each;
  - one million fuzz inputs;
  - 1,000 real mainnet transactions decoded against kit, read-only;
  - replay determinism on Node 22.18 or later, 24 and 26;
  - 100 kills;
  - 1,000 concurrent proposals;
  - performance.
- **A new dependency** is pinned exactly and recorded in `kb/REGISTRY.md`, and `npm audit signatures` must pass.

**6. 3.7 · The log anchor.** ANC-1 to ANC-5; ADR-015. Anchor 1.2.0, under `programs/solanaut_anchor`.
- **Deploying to devnet needs devnet SOL** that the keys do not hold (§5).
- **The verified build needs `solana-verify`,** which is not installed; Docker is. Installing it is a toolchain
  change: ask for approval with the exact command, and update `TOOLCHAIN.md`.
- **Include the `security.txt`.**

**7. 3.6 · The ElizaOS plugin.** ELZ-1 to ELZ-3; ADR-017. Pin `plugin-solana`'s published version, and test against
it.

**8. 3.4 · Opaque programs bounded.** OPQ-1 to OPQ-7; ADR-018. It needs Surfpool for the mainnet fork, and Surfpool
is not installed (§5).
- **Lighthouse's instruction set** is in `kb/sources/`.
- **If OPQ-6 cannot be met,** the Alpha ships with opaque programs denied, and says so (RK6). That is a result, not a
  failure to hide.

**9. 3.5 · Phantom paths.** PHX-1 to PHX-5. Depends on 3.1 and 3.4.
- **Build and test offline** whatever does not need the human:
  - the escalation record (PHX-2);
  - the MCP firewall's tool filter and its `networkId` check (PHX-3, PHX-4).
- **The human's part:** the co-sign in Phantom on devnet, and the separate OS user (PHX-5). Queue it in §5.

**10. 3.8 · Dashboard v1.** DSH-1 to DSH-4. Depends on 3.5. Operator actions are signed in Phantom, by the human, on
devnet.

**11. 3.10, preparation.**
- **Measure every threshold** (RT-1).
- **Run the loop battery** for runs of failed outcomes and alternating loops (RT-3). A proposed rule goes in an ADR,
  for the human.
- **Draft threat model v3.**
- **Leave RT-2 and the Alpha's review to Claude** (§8).

**If the human says the submission is near,** ask which items to bring forward. Nothing unmeasured goes into it.

## 5. Questions and requests for the human

Codex appends; the human answers in place. Open at the transfer:

| # | Asked | For | Request |
|---|---|---|---|
| H1 | 2026-10-05 | items 1, 6 | **Devnet SOL.** At the transfer the agent key held 0.032, the operator 0.277 and the treasury 0.059. The scenes' re-run needs about 1 SOL, and the anchor program's deploy several more. Fund `keys/devnet-operator.json`'s public key (`solana address --keypair keys/devnet-operator.json`) with 5 devnet SOL, from the faucet the human uses. |
| H2 | 2026-10-05 | item 8 | **Surfpool,** for 3.4's mainnet fork, is not installed. Approve installing a pinned release, and its line in `TOOLCHAIN.md`. |
| H3 | 2026-10-05 | item 6 | **`solana-verify`,** for 3.7's verified build, is not installed. Approve installing a pinned release. |
| H4 | 2026-10-05 | items 2, 9 | **OS users,** for the signer (ADR-013) and Phantom's MCP server (PHX-5), are created with `sudo` by the human, when Codex has the same-user modes working. |
| H5 | 2026-10-05 | Codex | **The machine-wide Gubernaut skills.** Six skills in `~/.agents/skills` load into every Codex session, this one included. `AGENTS.md` forbids them here; only the human can scope them to Gubernaut's own repository. |
| H6 | 2026-10-05 | every item | **Resolved on resume:** `gh run list/view` now work. Commit `2030ef7` CI passed, run `37397016363`. Historical baseline run `37369485468` failed because its office job was not acquired by a hosted runner; guard tests/typecheck passed. The transfer's green-CI statement was inaccurate for that run. No credential workaround used. |
| H7 | 2026-10-05 | Solanaut 1.0 foundations | **Accepted:** the human said “Go aheaaad, Continue the plan” after the explicit acceptance request for ADR-019 and ADR-020. Their dependent implementation may proceed. No readiness threshold or T4 permission changed. |
| H8 | 2026-10-05 | qualification | **External resources:** recruit outside developers, choose/fund the specialist audit and live bounty, and provide reliable devnet RPC for its soak. No contact or purchase made by Codex; all thresholds retained. |

## 6. Owed edits, to files Codex may not change

Codex appends one row for each edit it needs in `AGENTS.md`, `CLAUDE.md`, `.codex/`, `.claude/`,
`plugins/harness/hooks/`, `tools/boundary_guard.py`, `tools/session_close.py`, `tools/claims_lint.py` or
`tools/kb_lint.py`. Each row gives the exact text and why. Claude or the human applies them.

| # | File | Exact edit | Why | Applied |
|---|---|---|---|---|
| | | | | |
| O1 | AGENTS.md, build convention | Replace `TypeScript run natively by Node 26, with no build step; ESM;` with `TypeScript run natively by Node 26 for development; a release-only build emits JavaScript and declarations for npm consumers; ESM;` | Explicitly approved by the human in the Solanaut 1.0 mission. | no |

## 7. Codex's log

One row per completed queue step, newest last.

The live probes and baseline are complete. ADR-012 C is built and tested offline in
`evals/sdk/latch-c.md`; the complete queue item still owes the funded devnet rerun. Commit provenance:
`git log -- evals/sdk/latch-c.md`. The continuing run is `runs/2026-10-05-codex-solanaut-1.md`.

| Date | Item | Commit | Evidence | Note |
|---|---|---|---|---|
| | | | | |
| 2026-10-05 | 0: probes and baseline | commit containing this row; `git log -- runs/2026-10-05-codex-solanaut-1.md` | continuing run record | Correct live refusals; baseline tests/typecheck green; initial close gate finds uncommitted mission work. |
| 2026-10-05 | ADR-012 C, offline portion | `2030ef7` | `evals/sdk/latch-c.md`; CI `37397016363` passed | Funded devnet rerun still owed. |
| 2026-10-05 | release packaging foundation | commit containing `evals/packaging/packed-sdk.md` | packed consumer receipt | Private SDK candidate only; full product packaging and readiness remain open. |
| 2026-10-05 | package CI fault checks | commit containing `evals/packaging/ci-faults.md` | maintained fault receipt | Same damaged candidates checked on every push; full 3.9 programme still owed. |
| 2026-10-05 | maintained latch CI faults | commit containing `evals/ci/latch-faults.md` | latch fault receipt; prior matrix run `37397843820` passed | CI-1 partial; remaining injections and CI-2 gates are open. |
| 2026-10-05 | signed policy/version foundation | commit containing `evals/sdk/signed-policy.md` | POL/VER receipt | Existing SDK mode retained; isolated enforcement still owed. ADR-019/020 accepted. |
| 2026-10-05 | exclusive ownership/storage foundation | commit containing `evals/sdk/ownership.md` | OWN/STO receipt | Stale SDK takeover removed; Linux kernel mode tested across processes. Full SIG-8 and isolated enforcement remain owed. |
| 2026-10-05 | request admission identity foundation | commit containing `evals/sdk/request-identity.md` | LIF-1 receipt | Atomic identity/reservation and retry lookup built; signed-byte/send lifecycle next. Ownership CI `37400891997` passed. |
| 2026-10-05 | signing evidence journal foundation | commit containing `evals/sdk/signing-history.md` | LIF-2 receipt | SDK records checked lifecycle facts; executor/RPC next. Request CI `37401222564` passed. |
| 2026-10-05 | conservative executor foundation | commit containing `evals/signer/core.md` | LIF-3 receipt | Fake-RPC lifecycle boundaries tested; actual RPC/transport/isolation next. Signing CI `37401878957` passed. |
| 2026-10-05 | trusted devnet RPC boundary | commit containing `evals/signer/rpc.md` | RPC receipt | Fake-provider validation/failover tested; operational wiring, live outage and lookup reads still owed. |

## 8. Handing back to Claude

When the human asks for Claude, or when every item left needs the human or Claude, Codex checks each of these:

- [ ] Everything is committed and pushed, `tools/session_close.py` is green, and CI is green on the last commit.
- [ ] Every session has its run record in `runs/`. §7 is complete, §5 says what is waiting on the human, and §6 lists
      every owed edit.
- [ ] `PROGRESS.md` is true. Each milestone is marked achieved only with its evidence.
- [ ] A list in the last run record of every decision made inside an ADR, and of every proposed ADR.
- [ ] A list of every test whose assertion was changed or removed since `milestone/beta`, with the reason
      (`git diff milestone/beta..HEAD -- '*.test.ts' '*.test.mjs'`).
- [ ] Every number added to `docs/CLAIMS.md` names its command, its receipt and its date.

Claude, on its return:
1. Reads this file, the run records since `milestone/beta`, and the diff.
2. Applies §6, re-running each changed gate's self-test.
3. Reviews the work for what tests cannot see: weakened assertions, tuned constants, claims beyond their evidence.
4. Runs RT-2, the independent red team, with the black-box harness in `evals/independent/`, on code it did not write.
5. With the human, writes the Alpha's milestone review, and finalises.

## 9. What will bite: lessons from the Beta

- **`node --test` takes globs on Node 26.** `node --test tests/` fails; `npm test` already globs. A battery runs on its
  own as `node --test packages/sdk/test/<name>.test.ts`.
- **`/tmp` is cleared on reboot.** Two evaluator folders were lost that way. Scratch goes in `.sandbox/`.
- **The record is the state.** Any change to a rule can change what replay recomputes. Run `npm run replay` on the
  committed records after every rule change, and name every divergence in the receipt.
- **Fresh seeds after any change of definition.** Seeds that found a problem cannot also confirm its fix. Claim S7
  was stated too broadly once, and was scoped the same day.
- **The benign battery has two counting methods**, kept apart (`evals/sdk/fee-escalation.md`). Never compare figures
  across them.
- **Wallets and frameworks misbehave.** Solana Agent Kit signs plugin payments twice, and re-sends until it sees a
  status: on devnet it reported landed payments as failed. A wallet may sign a batch in place and return it short
  (D15). Test against the published package, never the documentation.
- **In SDK mode, the caller supplies time, heights and outcomes** (RK3). The signer (3.1) is what removes that trust.
  Do not weaken a check because a caller "would not" lie.
- **Devnet.** The public RPC rate-limits, the faucet refuses, and a slow status read once inflated a revoke's timing
  fourfold. Record slots beside wall-clock times.
- **The toolchain.** Anchor 1.2.0 selects Agave 3.1.10; never switch the active release. v1 needs Agave 4.2.2's
  validator, by its absolute path.
- **Keel's pin.** `@gubernaut/core` is 1.0.1, its bytes digest-checked. A bump is the human's decision (RK8,
  `kb/REGISTRY.md`).
- **The boundary guard's heuristic.** `git push`, `rm`, `cp` and a redirect all count as writes anywhere in a command.
  A command that also names a protected path is refused. Split the command, or use `apply_patch`.
- **Independence.** Each builder's battery passed, and the independent evaluators still found six defects in the gaps
  between them. Write each test from the requirement, not from the code.
