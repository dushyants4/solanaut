---
type: topic
status: current
created: 2026-09-27
updated: 2026-09-30
---

# Glossary

**Sources:**
- [npm and the installed package](../sources/2026-09-27_npm-gubernaut-core.md)
- [Solana fees](../sources/2026-09-27_solana-docs-fees.md)
- [lookup tables](../sources/2026-09-27_solana-docs-lookup-tables.md)
- [confirmation](../sources/2026-09-27_solana-docs-confirmation.md)
- [NIST](../sources/2026-09-27_nist-reference-monitor.md)
- [v1 transactions](../sources/2026-09-30_solana-upgrades-larger-transactions.md)
- [durable nonces](../sources/2026-09-30_solana-durable-nonces.md)
- [Squads: who may use a limit](../sources/2026-09-30_squads-v4-spending-limit-use.md)
- [Lighthouse](../sources/2026-09-30_lighthouse-program.md)

The words Solanaut's documents use, with one meaning each.

| Term | Meaning here |
|---|---|
| **Admission** | the guard's decision to let one proposal be signed; produces a receipt |
| **ALT** (address lookup table) | an on-chain list of addresses that a v0 transaction references by index; append-only |
| **Alpha MVP** | the *maximum* viable product, built and tested hard in Leg 3 of `docs/ROADMAP.md`; public version 0.9. The human's name: industry order puts alpha before beta |
| **Allowlist** | the programs, destinations or mints a policy names; anything not named is denied |
| **Beta MVP** | the *minimum* viable product built in Leg 2 of `docs/ROADMAP.md`: the guard v1, two adapters, the Squads limit on devnet and a first dashboard; public version 0.1 |
| **Blockhash expiry** | a transaction's blockhash is usable for about 151 blocks; after `lastValidBlockHeight` it never lands. A durable nonce removes this expiry |
| **Canary** | the one capped, human-run mainnet test that ADR-008 proposes |
| **Cockpit** | the dashboard: Solanaut's read-only web view of live decisions (`apps/cockpit`) |
| **Config authority** | the key that may change a controlled Squads multisig's settings and spending limits; here, the operator's |
| **DeFAI** | AI agents acting in DeFi with their own wallets |
| **Decision** | the guard's output for one proposal: allow or deny, the rule, the reason, the posture, the telemetry |
| **Drain** | moving an agent's funds to an address or program the operator never intended |
| **Durable nonce** | a value in a nonce account that replaces a transaction's recent blockhash, so the transaction does not expire; the guard denies it |
| **Fail closed** | any error, doubt or malformed input is a denial |
| **Intent** | one logical payment, which may take several signed attempts; each attempt is admitted only if no earlier one can still land |
| **Keel** | Gubernaut's controller, `@gubernaut/core`: three numbers in, a posture out |
| **Latch** | a guard state in which everything is denied until the operator releases it |
| **Leg** | one stage of the roadmap's parlay; it is won only when every milestone in it is achieved |
| **Lighthouse assertion** | an instruction for the Lighthouse program that fails a transaction if an account is not in the expected state; Phantom may append them |
| **Milestone** | a named achievement in `docs/ROADMAP.md`, reached when its gate passes, never by a date |
| **Opaque program** | an allowlisted program whose instructions the guard does not decode |
| **Pinned table** | a lookup table whose address and first entries the policy names; an index past the pin is denied |
| **Policy** | configuration the model never sees: allowlists and caps. Solanaut's injection defence |
| **Posture** | Keel's output: DEFAULT (benign), INHIBIT (an escalating spiral), REGROUND (a saturating loop) |
| **Principal** | the keys a policy guards; effects are the outflows they authorise |
| **Priority fee** | `ceil(compute_unit_price × compute_unit_limit / 1,000,000)` lamports in legacy and v0, on top of 5,000 lamports per signature; a lamport total in a v1 message's config |
| **Proposal** | a transaction the agent wants signed, reduced to what the guard needs |
| **Receipt** | proof of one admission, bound to the message's hash, with an expiry, usable once |
| **Reference monitor** | a mechanism that is always invoked, tamper-proof and small enough to verify (NIST) |
| **Reserve at admission** | counting an amount against a budget when it is allowed, not when it confirms |
| **Sensor** | Solanaut's code that turns the proposal stream into Keel's three numbers |
| **Spending limit** | Squads' on-chain cap per mint and period, with optional destinations |
| **Telemetry** | intensity (0–1), valence (−1–1), repetition (0–1): what Keel reads |
| **v1 transaction** | the format live on mainnet since 2026-09-15: up to 4,096 bytes, no lookup tables, fees and limits in a config section |
| **Window cap** | the most a policy allows within a rolling time window |
