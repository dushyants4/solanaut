# RISKS.md — what could stop the Alpha, and what is done about it

> **Draft 1** · 2026-10-01 · owner: architect, with the evaluator · for: the human, every seat · not public. Part of
> milestone 2c.1 in `docs/ROADMAP.md`, which the human approves. Register: `kb/DOCUMENTS.md`.

The threat model ([docs/papers/THREAT-MODEL.md](papers/THREAT-MODEL.md)) lists what an attacker can do to a running
guard: threats T1 to T30. This register is wider. It lists what could stop Solanaut being delivered as specified, or
make it claim more than it shows. A threat appears here only when it is also a risk to delivery, and then by its ID.

**Scales.**
- **Likelihood:** low, unlikely before the Alpha closes; medium, plausible; high, already seen, or expected.
- **Impact:** low, costs time; medium, a milestone slips or a claim narrows; high, a leg busts, or a claim would be
  wrong; critical, real funds or a key exposed.

**Owners** are seats (CLAUDE.md) or the human. Each risk is reviewed at every milestone review, and closed only with
evidence.

## 1. The product

| ID | Risk | L | I | Mitigation | Indicator | Owner | Status |
|---|---|---|---|---|---|---|---|
| RK1 | A loop that changes its shape and amount each turn is not stopped by Keel | high | medium | bounded by the fee window and the INHIBIT clamp; the Alpha's red team measures it; a rule on runs of failed outcomes is the candidate fix (`docs/SPEC.md` §12) | the loop battery's alternating case | architect, evaluator | open: not stopped in 12 turns (`evals/sdk/keel.md`) |
| RK2 | The latch stops a well-behaved agent: one early re-sign latches the guard until the operator signs | high | medium | ADR-012 proposes a narrower trip rule, measured to admit nothing the policy forbids | the demo's scene 5 on devnet | the human | open: decision owed (ADR-012) |
| RK3 | In SDK mode the caller supplies time, heights and outcomes, so a lying caller widens what is admitted (T20, T21) | medium | high | the signer process fetches them itself (milestone 3.1); until then the limit is stated in SPEC §2.1 and every claim is scoped to SDK mode | — | architect, builder | open until 3.1 |
| RK4 | Agent frameworks sign twice or report landed payments as failed, so integrations hit refusals or retry real payments | high | medium | D14 closed; `guardedWallet` follows up what it signed; integrators pass whole transactions; findings sent upstream (M12, M13) | refusals as `intent-in-flight` in the adapters battery | integrator | mitigated for Solana Agent Kit 2.0.10; ElizaOS unknown until 3.6 |
| RK5 | A listed Token-2022 mint changes a mutable setting after the operator checked it (T15) | low | high | only listed mints; the extension set pinned and re-read at admission (3.3) | — | builder | open until 3.3 |
| RK6 | Opaque programs, such as a Jupiter route, cannot be bounded within the Alpha (T3, T28) | medium | high | opaque programs stay denied by default; 3.4 is gated on a Jupiter route bounded on a Surfpool mainnet fork; if the gate fails, the Alpha ships with them denied and says so | 3.4's gate | architect | open |
| RK20 | Wallets that vary the priority fee per payment read as fee escalation: 15 of 3,000 benign payments stopped, each latching the guard | high | medium | S7 scoped to constant fees; candidate: score escalation only against attempts that did not land, measured on fresh seeds before any change (`docs/SPEC.md` §12) | the varied-fee benign battery (`evals/independent/e3-edges/`) | architect, evaluator | open: 0.50%, 95% interval 0.30–0.82% |
| RK7 | Durability across a power loss rests on `fsync` and is not measured | low | medium | S6 says "a crash", never "a power cut"; the on-chain limit bounds what a lost record could cost | — | evaluator | accepted, stated |

## 2. Dependencies

| ID | Risk | L | I | Mitigation | Indicator | Owner | Status |
|---|---|---|---|---|---|---|---|
| RK8 | Keel changes: a new release changes behaviour or its digest, or an upstream finding (U-1 to U-4) bites | medium | medium | the module and controller pinned by SHA-256; any bump re-runs the Keel and sensor batteries before its digest is accepted | a digest mismatch at `createGuard` | builder | mitigated (S4) |
| RK9 | Solana changes: Alpenglow's timing on mainnet, new instructions, new transaction formats | medium | medium | unknown versions and unlisted instructions are denied; 4.3's pre-flight re-checks commitment and expiry, and no timeout assumes 400 ms slots | release notes, SIMDs (`kb/sources/`) | architect | watched |
| RK10 | The Squads config authority is a single point of control (T30) | low | high | stated; a fresh operator account for any live test; the operator holds no other funds | — | the human | accepted, stated |
| RK11 | Framework churn: Solana Agent Kit, kit or ElizaOS change the interfaces the adapters wrap | medium | low | versions pinned; the adapters battery runs in CI | a failing adapters battery | integrator | watched |

## 3. Delivery

| ID | Risk | L | I | Mitigation | Indicator | Owner | Status |
|---|---|---|---|---|---|---|---|
| RK12 | Independent evaluation is hard to get: outside agent CLIs are refused when run unattended, and the account's usage limit stopped a multi-agent run | high | medium | runs the human starts; this session's subagents, given only the spec and audited for black-box reads; R.2's external audit | an owed evaluator run | evaluator, the human | open: one of three evaluators done, which found D15 and D16 (`evals/independent/`) |
| RK13 | Decisions wait on one person: ADRs, sign-offs and every T4 step | high | medium | decisions batched into milestone reviews; reversible work continues while one is open | an open decision older than a milestone | the human, archivist | open: ADR-012, the Beta sign-off |
| RK14 | The Alpha's thresholds are ambitious, and Leg 3 busts on any miss: 95% coverage, 80% mutation, a million fuzz inputs, 1,000 mainnet transactions, a 72-hour soak, three outside developers | high | medium | 2c.1 confirms or trims each threshold before Leg 3 starts, with the human, so none is dropped silently later | — | evaluator, the human | open: for 2c.1 |
| RK15 | The contest's deadline (2026-10-12) pressures claims past the evidence | medium | high | every public sentence traces to `docs/CLAIMS.md`; `tools/claims_lint.py` gates each measured row; the human submits only achieved milestones | a sentence in a draft with no row | archivist, the human | mitigated |
| RK16 | The public devnet RPC rate-limits and its faucet refuses, stalling devnet milestones | high | low | reads back off, sends never retry; the drills resume on existing accounts; the human funds the operator; 4.3 requires two RPC providers | HTTP 429s in a run record | operator | mitigated for the Beta |
| RK17 | Reusing the Gubernaut workspace's tooling would breach the isolation the project exists under | medium | medium | the boundary guard; CLAUDE.md's isolation rule; any change to it is the human's, recorded as an ADR | a request to use APEX tooling | harness | mitigated |

## 4. Keys and operations

| ID | Risk | L | I | Mitigation | Indicator | Owner | Status |
|---|---|---|---|---|---|---|---|
| RK18 | A key leaks: a devnet key read by an outside model, or a real-funds key placed in this tree | low | low for devnet; critical for real funds | no real-funds key in the tree; devnet keys gitignored and made by `solana-keygen`; the secret scan at every close; outside agents jailed away from `keys/` | the secret scan | operator | mitigated |
| RK19 | The live Phantom test goes wrong: a misclick, or a compromised operator wallet (T18, T30) | low | high | devnet first, as the human chose; a fresh account; the runbook passes twice before (4.2); real funds only under ADR-008, by the human | — | the human | open until Leg 4 |

## Changes

| Version | Date | What changed |
|---|---|---|
| Draft 1 | 2026-10-01 | First register, for milestone 2c.1: 19 risks, from the Beta's run records, `docs/SPEC.md` §12, the threat model and `kb/REGISTRY.md`. |
| Draft 1.1 | 2026-10-03 | RK20 added, from the independent evaluator's varied-fee battery; RK12's status updated. |
