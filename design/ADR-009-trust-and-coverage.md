# ADR-009 · The guard trusts only what it derives or verifies

**Status:** accepted 2026-09-30, in the verified-review plan the human approved. It refines
[ADR-004](ADR-004-admission-and-receipts.md) and **supersedes three parts of [ADR-005](ADR-005-transaction-coverage.md)**:
point 2 (v1 denied, and lookup tables supplied by the caller), point 3 (a list of decoded instructions) and the
consequence "the caller controls lookup-table contents".

## Context

A verified review on 2026-09-30 ([run record](../runs/2026-09-30-verified-review-roadmap.md)) found:

- **v1 is live.** SIMD-0296 and SIMD-0385 activated on mainnet on 2026-09-15 and are live on devnet. A v1 message
  carries its priority fee as a lamport total in a config section, has no lookup tables, and runs ComputeBudget
  instructions as no-ops. `@solana/kit` 8 builds v1 when asked to
  ([source](../kb/sources/2026-09-30_solana-upgrades-larger-transactions.md),
  [source](../kb/sources/2026-09-30_solana-dev-skill-transactions-v1.md)). ADR-005's own reversal condition is met.
- **Durable nonces.** A transaction whose first instruction advances a nonce uses the nonce in place of a recent
  blockhash and does not expire ([source](../kb/sources/2026-09-30_solana-durable-nonces.md)). Intents that wait for
  expiry never see it expire.
- **Lookup tables are append-only.** A closed table's address can never be re-created
  ([source](../kb/sources/2026-09-30_anza-lookup-table-properties.md)), so a pinned prefix of a table stays true.
- **Caller-supplied facts.** `docs/SPEC.md` Draft 1 took time, block heights, expiry heights, table contents and
  intent keys from the caller, which in signer mode is the untrusted agent.
- **Coverage.** Draft 1 listed a few instructions per program and never said that an unlisted instruction of an
  allowlisted program is denied. The System Program has more instructions, including CreateAccountAllowPrefund
  ([SIMD-0312](../kb/sources/2026-09-30_simd-0312-create-account-allow-prefund.md)).
- **The fee rule** computed 0 when a compute-unit price was set without a limit, although the runtime then applies
  default limits ([source](../kb/sources/2026-09-27_solana-docs-fees.md)).
- **Wallets that change transactions.** Phantom may append Lighthouse assertions, so the signed message can differ
  from the admitted one ([source](../kb/sources/2026-09-30_phantom-lighthouse.md)).

## Decision

1. **Trust per mode.**
   - **SDK in-process:** time, block heights and outcome reports come from the agent's framework code. They are
     trusted by assumption, recorded in the log, and the mode's limit is stated: a process that can lie about them
     can also call the key.
   - **Signer or proxy:** the signer stamps time from its own monotonic clock, fetches block height and blockhash
     validity itself from the operator's RPC, and reads outcomes from signature statuses. Caller values are ignored.
2. **Lookup tables are pinned.** The policy pins each allowed table by address and a prefix of its entries. An index
   at or past the pinned length is denied, and an unpinned table is denied. In the Alpha's signer mode, an
   unpinned table may be resolved at finalized commitment.
3. **Legacy, v0 and v1 are decoded; unknown versions are denied.** In v1 the fee and limits come from the config,
   and any ComputeBudget instruction in a v1 message is denied.
4. **An allowlist per instruction.** Every instruction of a decoded program is value-moving (its destination and
   amount are checked), authority-granting (denied), benign (allowed), or unknown (denied as `instruction-denied`).
5. **Durable nonces are denied** in every version, as `durable-nonce-denied`: a message whose first instruction
   advances a nonce, and every nonce instruction.
6. **The principal.** The policy names the guarded keys. Effects are the outflows they authorise. A message that
   needs any other signer is denied as `other-signer` until co-signing is designed (the Alpha).
7. **Fees.** The priority fee is v1's config total, or price times the explicit limit, or price times the runtime's
   default limit when none is set. Base fees and tips to listed tip accounts count toward the fee window. Lamports
   paid into a new account count as SOL to that account, which must be an allowed destination.
8. **Intents by effects.** In-flight detection uses the hash of the effects, whatever intent key the caller sends. A
   caller's key may group attempts for display; it never splits them.
9. **No change after admission.** An adapter compares the signed message with the admitted one and throws on any
   difference. The only exception, for a wallet in scope that appends Lighthouse instructions (Phantom, in the
   Alpha), requires every admitted instruction byte-identical and in order, appended instructions for the Lighthouse
   program only with read-only accounts, and the fee check run again.
10. **Message signing stays denied.** A raw ed25519 signature over a message's bytes is a valid transaction
    signature.
11. **The core decoder does not use `@solana/web3.js`.** It decodes bytes itself and is cross-checked in tests
    against `@solana/kit`'s codecs and the `@solana-program` parsers.

## Consequences

- `docs/SPEC.md` Draft 2 carries these rules (§2.1, §4, §5) and new battery cases.
- The pinned local validator (Agave 3.1.10) cannot run v1. v1 integration tests need Agave 4.2.2 or later, run by
  its absolute path, or Surfpool 1.5 or later (`TOOLCHAIN.md`).
- Operators pin lookup tables. A small command that fetches a table at finalized commitment and prints the pin is
  owed with the decoder (milestone 2a.2).
- Some legitimate flows are denied until the Alpha: co-signed transactions, nonce transactions, ATA creation.

## Would show this was wrong

- Pinning tables makes common agent flows unusable in the SDK mode. Then the signer mode's resolver moves forward.
- The decoder's view of real transactions differs from the runtime's on the differential test set. Then the
  decoder is wrong, not the set.
- A wallet in scope appends instructions other than Lighthouse's. Then the exception is re-designed, not widened.
