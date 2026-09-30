# CLAIMS.md — what Solanaut may say, and where each claim comes from

**Every public sentence about Solanaut or Gubernaut traces to a row here.** That covers the README,
the pitch video, the demo video, the Colosseum page, and any post. A number that is not in this file
is not said.

Gubernaut's figures are **Gubernaut's**, quoted as "Gubernaut reports …" with their scope, and never
restated as Solanaut's own results. Facts about other people's incidents and products are quoted with
their source and scope (§5).

This is a T3 file: a change needs a source, not a preference. Papers cite rows by ID, for example
[S1], [G6] or [M4]. Sources are public, and each has a note in `kb/sources/` with the date it was
checked.

Written 2026-09-27. Revised 2026-09-27: row IDs added; S4 narrowed; G6 corrected; G7, G8 and §5
added. The record of that revision is `runs/2026-09-27-research-foundation.md`. Revised 2026-09-30: M9 refined from
Squads' source; M10 and M11 added; the not-yet-claimable list and §4 extended; S5 notes the proposed canary. The
record is `runs/2026-09-30-verified-review-roadmap.md`.

## 1. Solanaut's own claims

| ID | Claim | Status | Evidence |
|---|---|---|---|
| S1 | The policy denies a transfer to a destination not on the allowlist, and a program not on the allowlist, before anything is signed | **measured (sandbox)** | `packages/sdk/test/guard.test.ts`; `npm run sandbox -- --cluster local` on 2026-09-27: the drain proposals were never sent, and the chain held only the airdrop and the four allowed payments |
| S2 | The policy holds whatever the model says, because the model never sees or sets it | **architectural** | `policy.ts`: configuration outside the model. True only while the policy itself is kept out of the agent's reach, so say that too. **Until H1 fixes it, `guard.policy` can be mutated by code holding the guard** (`docs/SPEC.md` §10, defect D1): do not demo policy immutability |
| S3 | An identical failing transfer, retried, is stopped by Keel's control loop | **measured (sandbox), sensor v0** | Stopped at **turn 3** (DEFAULT → DEFAULT → REGROUND), with retries 400 ms apart. One scenario, one sensor version, one timing. Not a benchmark: never state it without "in the sandbox" |
| S4 | Any guard error denies (fail closed). Solanaut pins Keel 1.0.1 and refuses a build that **declares** a different controller digest | **measured (tests), narrowed 2026-09-27** | `guard.test.ts`: NaN telemetry → `fail-closed`; wrong expected digest → creation rejected. **What it does not prove:** Keel 1.0.1 exposes its digest as a constant and checks only the byte length on load ([source](../kb/sources/2026-09-27_npm-gubernaut-core.md)), so the bytes themselves are not yet hashed. Never say "an unverified binary is refused" until H1 hashes the embedded controller |
| S5 | Runs on devnet; no real funds | **fact, and a decision** | `design/ADR-003-devnet-only.md`. A capped, human-run mainnet canary is **proposed** (`design/ADR-008-mainnet-canary.md`); S5 stays true unless the human accepts it and the canary runs |

**Not yet claimable, and why:**
- **Any detection rate, block rate or false-stop rate.** Nothing has been measured beyond the sandbox
  scenarios. H1 builds the batteries and H4 runs the adversarial one; until then no percentage exists.
- **Any latency for the guard as a whole.** Keel's tick is measured upstream (§2); Solanaut's policy,
  sensor and transaction decoding are not.
- **Priority-fee or SOL savings.** Never measured on Solana (§3).
- **That Solanaut would have prevented a named incident.** None of §5 happened on Solanaut's stack.
  The honest form is "a transfer **shaped like** X is denied by rule Y", shown on devnet.
- **That no other product controls retries or fees.** The research found none documenting it
  (`docs/papers/MARKET.md`), but absence of evidence is not a claim. Never say "the only" or "the
  first".
- **That Solanaut's caps or allowlists are new.** Signing services, on-chain programs and at least one open-source
  agent wallet document them (`docs/papers/MARKET.md`).
- **Coverage of SPL tokens, v0 or v1 transactions, the allowlist per instruction, pinned lookup tables, fee caps,
  intents, receipts, or restore on start.** They are specified (`docs/SPEC.md` Draft 2), not built.
- **Anything about mainnet.** Nothing is said about mainnet until the canary report exists (`docs/ROADMAP.md`,
  milestone 4.5), and then only within its scope.
- **Production-ready, audited or certified.** Not until `docs/READINESS.md`'s milestones say so, with their
  evidence.

## 2. Gubernaut's figures Solanaut may quote, with their scope

Sources: the public packages and repositories, checked 2026-09-27.
[`@gubernaut/core` on npm](https://www.npmjs.com/package/@gubernaut/core) (version 1.0.1, the one
Solanaut pins), [github.com/thegubernaut/gubernaut](https://github.com/thegubernaut/gubernaut) (`main`
at 4f186fa) and [gubernaut.com/releases](https://gubernaut.com/releases).

| ID | Claim, as Gubernaut states it | Scope that must travel with it |
|---|---|---|
| G1 | The controller reads three bounded numbers per turn (intensity, valence, repetition), never text | The **controller** only. Keel's README: *"if your sensor can be talked into reporting a low intensity, the controller will faithfully act on a low intensity. Gubernaut is not injection-proof, and there is no jailbreak success-rate figure here because none was measured."* |
| G2 | One tick: roughly 125 ns (wasm, Cloudflare workerd); 200 ns p99 (the same wasm in a Node worker) | A controller tick, not Solanaut's guard. The workerd figure is "external-throughput-derived", a mean from a local workerd build |
| G3 | Bit-exact with the Python reference: 73 value-exact steps across 8 scenarios, plus 8 boundary rejections; 10,000 ticks bit-exact with flat memory | Keel's own test corpus. The boundary cases are numeric; Solanaut has not re-run the corpus |
| G4 | On its verbatim-loop battery, governed spend was 4.1% to 20.2% of ungoverned: savings of **79.8% at worst and up to 95.9% at best**, across seven configurations in four model families | **LLM API spend**, through the Tiller proxy, on a **verbatim-loop** battery. The ceiling never travels without the floor. One configuration (Gemini-native Gemma) is measured in tokens, not dollars. "on an agent that never loops it saves nothing". **It says nothing about Solana fees** |
| G5 | The proxy does not appraise assistant or tool messages, so a loop confined to them is outside its detection | Gubernaut's own stated limit (its README) |
| G6 | Apache-2.0 and open source. First public release 2026-07-29, when the source went public; `@gubernaut/core` 1.0.1 published on npm 2026-08-07 | The **disclosure** Colosseum requires (rules §9; the FAQ: "disclose all relevant past development work"). Corrected 2026-09-27: this said "public since July 2026", which is true of Gubernaut but not of `@gubernaut/core` |
| G7 | On a **local ephemeral EVM devnet** (ganache, chain 31337, "not a public testnet and not a mainnet"), a governed ElizaOS agent was severed at turn 4 after 3 reverted transactions; ungoverned, it sent 8 | Gubernaut's pre-existing on-chain receipts (2026-07-21), made with **Tiller's client, not Keel**, on EVM. Nothing Gubernaut has published touches Solana. Quote it only as prior work, in the disclosure |
| G8 | Keel's constants are working defaults, not the held-out configuration of Gubernaut's validation record | Must accompany any Gubernaut figure used near a description of what Keel does inside Solanaut |

## 3. The drop documents, triaged

`Docs-Dashy-Drop/` (registered in `kb/intake/2026-09-27_dashy-drop.md`) holds AI-drafted strategy
notes. They are useful as ideas and **not a source for any claim.** Each claim below was checked
against the sources in §2 and the official hackathon rules.

| Drop claim | Verdict | Why |
|---|---|---|
| "un-hackable", "bulletproof", "mathematically guaranteed", "Complete" injection defence | **rejected** | Contradicted by Keel's own README (§2, G1). The honest claim is S2 |
| "100% reduction in successful prompt-injection wallet drains" / "blocked 100% of 400 injections" | **rejected** | Never measured; the second is a projection written as a result |
| An injection makes intensity and repetition spike, so the governor blocks it | **rejected** | Unmeasured. Gubernaut's published limits say its text sensor missed calmly worded hostile input 5 of 5, and a calm injection in token metadata is exactly that case. Solanaut's injection defence is the policy, not the loop |
| "79.8% to 95.9% reduction in wasted priority fees" / "$0.1669 → $0.0068 … prevents priority fee exhaustion" | **rejected as stated** | Those are Gubernaut's **LLM API spend** figures; quote them only as G4 does. Solana fee savings would need their own measurement |
| "sub-millisecond", "≤ 1 ms" | **rejected as a slogan** | Use the measured, scoped tick figures (G2) instead; Solanaut's own guard latency is unmeasured |
| "INHIBIT … invokes a local hard-stop" | **wrong** | INHIBIT is a clamp on an escalating spiral, and REGROUND is the saturating loop (Keel README). The temperature clamp applies under both |
| "Week 1: port the HRL to a Rust crate and WASM" | **already exists** | `gubernaut-core` (crates.io) and `@gubernaut/core` (npm, wasm inlined). Solanaut consumes them |
| "Tiller (Python) and Keel (Node / on-chain)" | **wrong** | Keel is the controller in-process for JavaScript, TypeScript and Rust. Nothing Gubernaut ships runs on-chain; its on-chain receipts are EVM test scripts (G7) |
| "Judges penalize legacy code" | **not in the rules** | The official rules (§8) judge functionality, impact, novelty, UX, open-source composability and business plan. §9 and the FAQ require *disclosing* prior work |
| "Gubernaut is the only token-free governor in existence" / "zero competition" | **unverified** | A market claim with no source. Do not say it |
| Latency of LLM guardrails (200–800 ms), multisig co-signers (400–1200 ms) | **unverified** | No source given. Do not quote |
| "$250,000 pre-seed for 7%" | **half-verified** | colosseum.com/worldsfair says accepted teams receive "$250,000 pre-seed funding". The equity figure has no source here |
| Mainnet Fortress Vault, $5–10k SOL, pay-to-attack fees | **out of scope** | `design/ADR-003-devnet-only.md`: the human chose devnet only on 2026-09-27 |
| Ratings ("Colosseum win probability 9.2 / 10" and the like) | **not facts** | Opinions from a drafting model |

## 4. Words Solanaut does not use about itself

un-hackable · unhackable · bulletproof · injection-proof · guaranteed · 100% safe · zero risk · the
only · the first · prevents (of a named incident) · would have prevented · sub-millisecond (as a
slogan) · "we" in the SDK's reference docs · production-ready, mainnet-ready, audited and certified (each until it is
true, with its evidence).

## 5. Facts about the world Solanaut may cite, with their scope

M1 to M9 were re-read first-hand on 2026-09-27; M9's refinement, M10 and M11 on 2026-09-30. None of these incidents
happened on Solanaut's stack. Solanaut may say what happened, and which of its rules would deny a transaction
**shaped like** it.

| ID | Fact | Source | Scope that must travel with it |
|---|---|---|---|
| M1 | Freysa's only rule, "never send the money", lived in its prompt; on attempt 482, from 195 players, it paid out $47,316.05 | [The Block, 2024-11-29](../kb/sources/2026-09-27_the-block-freysa.md) | A paid game built to be attacked, on Base |
| M2 | An attacker with access to AIXBT's dashboard queued two prompts, and the agent sent 55.5 ETH ($106,200) | [Cointelegraph, 2025-03-19](../kb/sources/2026-09-27_cointelegraph-aixbt.md) | Base. The maintainer says the AI itself was not manipulated: say "a breached dashboard", never "prompt injection" |
| M3 | Research on ElizaOS showed injected memories can trigger unauthorised transfers, and that prompt-injection defences "only provide limited protection when stored context is corrupted" | [arXiv 2503.16248](../kb/sources/2026-09-27_arxiv-fake-memories.md) | Research attacks, not a documented loss |
| M4 | On Solana, an agent meant to spend about 4 SOL sent about 5% of a token's supply after a session crash erased its wallet state; its owner says it was not an attack | [the owner's post, 2026-02-23](../kb/sources/2026-09-27_substack-lobstar-wilde.md) | Quote the share of supply, not a dollar value: the reported values differ |
| M5 | A gifted NFT raised an AI wallet's permissions, and a Morse-coded reply then moved 3 billion DRB ($150,000–$174,000); about 80% was returned | [Giskard, 2026-05-07](../kb/sources/2026-09-27_giskard-grok-bankr.md) | The chain is not stated in the source |
| M6 | Backdoored `@solana/web3.js` 1.95.6 and 1.95.7 stole private keys from projects that handle them directly; 674.86 SOL ($164,100) was stolen | [The Hacker News, 2024-12-04](../kb/sources/2026-09-27_thehackernews-web3js-backdoor.md) | Not an AI-agent incident; about keys in-process |
| M7 | 341 of 2,857 audited agent skills on ClawHub were malicious, some posing as Solana wallets, stealing wallet keys | [The Hacker News, 2026-02-02](../kb/sources/2026-09-27_thehackernews-clawhavoc.md) | No theft total is sourced; do not quote one |
| M8 | From Aug 2023 to Jul 2024, bot accounts' non-vote Solana transactions failed 58.43% of the time and human accounts' 6.22%; expired validity windows caused 17.72% of failures | [arXiv 2504.18055](../kb/sources/2026-09-27_arxiv-solana-failed-transactions.md) | Bots, not AI agents. No documented loss comes from an AI agent escalating its own fees |
| M9 | Squads v4 spending limits cap one mint per period for named members, optionally only to listed destinations. A limit's members need not be members of the multisig, and an empty destination list allows any address | [docs.rs](../kb/sources/2026-09-27_squads-spending-limit.md); [spending_limit_use.rs](../kb/sources/2026-09-30_squads-v4-spending-limit-use.md); [multisig_add_spending_limit.rs](../kb/sources/2026-09-30_squads-v4-add-spending-limit.md) | A description of Squads' program on its `main` branch, read 2026-09-30, which Solanaut composes with (ADR-006). It is Squads' guarantee, not Solanaut's |
| M10 | Solana's v1 transaction format (SIMD-0296 and SIMD-0385) activated on mainnet on 2026-09-15. It allows 4,096 bytes, has no address lookup tables, and holds the priority fee as a lamport total in a config section; legacy and v0 stay at 1,232 bytes | [solana.com](../kb/sources/2026-09-30_solana-upgrades-larger-transactions.md); [the Foundation's v1 reference](../kb/sources/2026-09-30_solana-dev-skill-transactions-v1.md) | A fact about Solana, not about Solanaut. Solanaut decodes v1 only once milestone 2a.2 is achieved |
| M11 | Phantom may add Lighthouse assertion instructions to a transaction submitted to it, so the transaction on-chain can differ from the one submitted, and an assertion can make it fail | [Phantom's docs](../kb/sources/2026-09-30_phantom-lighthouse.md) | Phantom's behaviour, per its docs. The page does not say which methods or platforms, or whether a dApp can opt out |
