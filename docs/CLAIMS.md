# CLAIMS.md — what Solanaut may say, and where each claim comes from

**Every public sentence about Solanaut or Gubernaut traces to a row here.** README, pitch video,
demo video, the Colosseum page, posts: all of it. A number that is not in this file is not said.
Gubernaut's figures are **Gubernaut's**, quoted as "Gubernaut reports …" with their scope, never
restated as Solanaut's own results. This is a T3 file: a change needs a source, not a preference.

Written 2026-09-27. Sources are public, with a date checked.

## 1. Solanaut's own claims

| Claim | Status | Evidence |
|---|---|---|
| The policy denies a transfer to a destination not on the allowlist, and a program not on the allowlist, before anything is signed | **measured (sandbox)** | `packages/sdk/test/guard.test.ts`; `npm run sandbox -- --cluster local` on 2026-09-27: the drain proposals were never sent, and the chain held only the airdrop and the four allowed payments |
| The policy holds whatever the model says, because the model never sees or sets it | **architectural** | `policy.ts`: configuration outside the model. True only while the policy itself is kept out of the agent's reach; say that too |
| An identical failing transfer, retried, is stopped by Keel's control loop | **measured (sandbox), sensor v0** | stopped at **turn 3** (DEFAULT → DEFAULT → REGROUND) with retries 400 ms apart. One scenario, one sensor version, one timing. Not a benchmark: never state it without "in the sandbox" |
| Any guard error denies (fail closed); an unverified Keel binary is refused at startup | **measured (tests)** | `guard.test.ts`: NaN telemetry → `fail-closed`; wrong digest → creation rejected |
| Runs on devnet; no real funds | **fact, and a decision** | `design/ADR-003-devnet-only.md` |

**Not yet claimable, and why:**
- **Any detection rate, block rate or false-stop rate.** Nothing has been measured beyond the
  sandbox scenarios. Phase H1 builds the batteries; H4 runs the adversarial one. Until then, no
  percentage exists.
- **Any latency for the guard as a whole.** Keel's tick is measured upstream (§2); Solanaut's
  policy, sensor and web3.js decoding are not.
- **Priority-fee or SOL savings.** Never measured on Solana. See §3.

## 2. Gubernaut's figures Solanaut may quote, with their scope

Source: the public packages and repositories, checked 2026-09-27.
[`@gubernaut/core` README on npm](https://www.npmjs.com/package/@gubernaut/core) (version
1.0.1, the version Solanaut pins) and
[github.com/thegubernaut/gubernaut](https://github.com/thegubernaut/gubernaut).

| Claim, as Gubernaut states it | Scope that must travel with it |
|---|---|
| The controller reads three bounded numbers per turn (intensity, valence, repetition), never text | the **controller** only. Keel's README: *"if your sensor can be talked into reporting a low intensity, the controller will faithfully act on a low intensity. Gubernaut is not injection-proof, and there is no jailbreak success-rate figure here because none was measured."* |
| One tick: roughly 125 ns (wasm, Cloudflare workerd); 200 ns p99 (the same wasm in a Node worker) | a controller tick, not Solanaut's guard; the workerd figure is derived from external throughput |
| Bit-exact with the Python reference: 73 value-exact steps across 8 scenarios, plus 8 boundary rejections; 10,000 ticks bit-exact with flat memory | Keel's own test corpus |
| On its verbatim-loop battery, governed spend was 4.1% to 20.2% of ungoverned: savings of **79.8% at worst and up to 95.9% at best**, across seven configurations in four model families | **LLM API spend**, through the Tiller proxy, on a **verbatim-loop** battery. The ceiling never travels without the floor. One configuration (Gemini-native Gemma) is measured in tokens, not dollars. **It says nothing about Solana fees** |
| The proxy does not appraise assistant or tool messages, so a loop confined to them is outside its detection | Gubernaut's own stated limit (its README) |
| Apache-2.0, open source, pre-existing (public since July 2026) | the **disclosure** Colosseum's rules §9 require |

## 3. The drop documents, triaged

`Docs-Dashy-Drop/` (registered in `kb/intake/2026-09-27_dashy-drop.md`) are AI-drafted strategy
notes. Useful as ideas; **not a source for any claim.** Each claim below was checked against the
sources in §2 and the official hackathon rules.

| Drop claim | Verdict | Why |
|---|---|---|
| "un-hackable", "bulletproof", "mathematically guaranteed", "Complete" injection defence | **rejected** | contradicted by Keel's own README (§2). The honest claim is the policy one in §1 |
| "100% reduction in successful prompt-injection wallet drains" / "blocked 100% of 400 injections" | **rejected** | never measured; the second is a projection written as a result |
| An injection makes intensity and repetition spike, so the governor blocks it | **rejected** | unmeasured. Gubernaut's published limits say its text sensor missed calmly worded hostile input 5 of 5; a calm injection in token metadata is exactly that case. Solanaut's injection defence is the policy, not the loop |
| "79.8% to 95.9% reduction in wasted priority fees" / "$0.1669 → $0.0068 … prevents priority fee exhaustion" | **rejected as stated** | those are Gubernaut's **LLM API spend** figures; quote them only as §2 does. Solana fee savings would need their own measurement |
| "sub-millisecond", "≤ 1 ms" | **rejected as a slogan** | use the measured, scoped tick figures in §2 instead; Solanaut's own guard latency is unmeasured |
| "INHIBIT … invokes a local hard-stop" | **wrong** | INHIBIT is a clamp on an escalating spiral; REGROUND is the saturating loop (Keel README) |
| "Week 1: port the HRL to a Rust crate and WASM" | **already exists** | `gubernaut-core` (crates.io) and `@gubernaut/core` (npm, wasm inlined). Solanaut consumes them |
| "Tiller (Python) and Keel (Node / on-chain)" | **wrong** | Keel is the controller in-process for JavaScript/TypeScript and Rust. Nothing Gubernaut ships runs on-chain |
| "Judges penalize legacy code" | **not in the rules** | the official rules (§8) judge functionality, impact, novelty, UX, open-source composability and business plan; §9 requires *disclosing* third-party and open-source code |
| "Gubernaut is the only token-free governor in existence" / "zero competition" | **unverified** | a market claim with no source. Do not say it |
| Latency of LLM guardrails (200–800 ms), multisig co-signers (400–1200 ms) | **unverified** | no source given. Do not quote |
| "$250,000 pre-seed for 7%" | **half-verified** | colosseum.com says winners may join the accelerator "with $250,000 in funding". The equity figure has no source here |
| Mainnet Fortress Vault, $5–10k SOL, pay-to-attack fees | **out of scope** | `design/ADR-003-devnet-only.md`: the human chose devnet only on 2026-09-27 |
| Ratings ("Colosseum win probability 9.2 / 10" and the like) | **not facts** | opinions from a drafting model |

## 4. Words Solanaut does not use about itself

un-hackable · unhackable · bulletproof · injection-proof · guaranteed · 100% safe · zero risk ·
the only · sub-millisecond (as a slogan) · "we" in the SDK's reference docs.
