---
type: topic
status: current
created: 2026-09-27
updated: 2026-09-27
---

# Glossary

**Sources:**
- [npm and the installed package](../sources/2026-09-27_npm-gubernaut-core.md)
- [Solana fees](../sources/2026-09-27_solana-docs-fees.md)
- [lookup tables](../sources/2026-09-27_solana-docs-lookup-tables.md)
- [confirmation](../sources/2026-09-27_solana-docs-confirmation.md)
- [NIST](../sources/2026-09-27_nist-reference-monitor.md)

The words Solanaut's documents use, with one meaning each.

| Term | Meaning here |
|---|---|
| **Admission** | the guard's decision to let one proposal be signed; produces a receipt |
| **ALT** (address lookup table) | an on-chain list of addresses that a v0 transaction references by index |
| **Allowlist** | the programs, destinations or mints a policy names; anything not named is denied |
| **Blockhash expiry** | a transaction's blockhash is usable for about 151 blocks; after `lastValidBlockHeight` it never lands |
| **Cockpit** | Solanaut's read-only web view of live decisions (H4) |
| **DeFAI** | AI agents acting in DeFi with their own wallets |
| **Decision** | the guard's output for one proposal: allow or deny, the rule, the reason, the posture, the telemetry |
| **Drain** | moving an agent's funds to an address or program the operator never intended |
| **Fail closed** | any error, doubt or malformed input is a denial |
| **Intent** | one logical payment, which may take several signed attempts; each attempt is admitted only if no earlier one can still land |
| **Keel** | Gubernaut's controller, `@gubernaut/core`: three numbers in, a posture out |
| **Latch** | a guard state in which everything is denied until the operator releases it |
| **Opaque program** | an allowlisted program whose instructions the guard does not decode |
| **Policy** | configuration the model never sees: allowlists and caps. Solanaut's injection defence |
| **Posture** | Keel's output: DEFAULT (benign), INHIBIT (an escalating spiral), REGROUND (a saturating loop) |
| **Priority fee** | `ceil(compute_unit_price × compute_unit_limit / 1,000,000)` lamports, on top of 5,000 lamports per signature |
| **Proposal** | a transaction the agent wants signed, reduced to what the guard needs |
| **Receipt** | proof of one admission, bound to the message's hash, with an expiry, usable once |
| **Reference monitor** | a mechanism that is always invoked, tamper-proof and small enough to verify (NIST) |
| **Reserve at admission** | counting an amount against a budget when it is allowed, not when it confirms |
| **Sensor** | Solanaut's code that turns the proposal stream into Keel's three numbers |
| **Spending limit** | Squads' on-chain cap per mint and period, with optional destinations |
| **Telemetry** | intensity (0–1), valence (−1–1), repetition (0–1): what Keel reads |
| **Window cap** | the most a policy allows within a rolling time window |
