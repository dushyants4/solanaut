---
type: topic
status: current
created: 2026-09-27
updated: 2026-09-30
---

# Solana transactions, as a firewall must read them

**Sources:**
- [transactions](../../sources/2026-09-27_solana-docs-transactions.md)
- [lookup tables](../../sources/2026-09-27_solana-docs-lookup-tables.md)
- [fees](../../sources/2026-09-27_solana-docs-fees.md)
- [confirmation](../../sources/2026-09-27_solana-docs-confirmation.md)
- [failed transactions](../../sources/2026-09-27_arxiv-solana-failed-transactions.md)
- [larger transactions and v1](../../sources/2026-09-30_solana-upgrades-larger-transactions.md)
- [the Foundation's v1 reference](../../sources/2026-09-30_solana-dev-skill-transactions-v1.md)
- [durable nonces](../../sources/2026-09-30_solana-durable-nonces.md)
- [lookup-table properties](../../sources/2026-09-30_anza-lookup-table-properties.md)
- [SIMD-0312](../../sources/2026-09-30_simd-0312-create-account-allow-prefund.md)
- [SIMD-0266, p-token](../../sources/2026-09-30_simd-0266-p-token.md)
- [Alpenglow](../../sources/2026-09-30_solana-alpenglow.md)

What a transaction firewall has to understand about a Solana transaction before it can decide anything about it.

## Key takeaways

- **Three formats, all live.** Legacy and v0 carry at most 1,232 bytes. v1 went live on mainnet on 2026-09-15 and is
  live on devnet: up to 4,096 bytes, it starts with the byte `0x81`, has no lookup tables, and holds its compute
  limit, loaded-data limit, heap size and priority fee in a config section.
- **In v1, ComputeBudget instructions are no-ops.** A reader that scans them for fees reads "silent zeros"; the fee
  is a lamport total in the config.
- **Lookup tables hide addresses, but never change them.** A v0 transaction references addresses "by its 1-byte index
  within the table". Tables are append-only, and a closed table's address can never be re-created, so a pinned prefix
  of a table stays true.
- **The priority fee** is "ceil(compute_unit_price * compute_unit_limit / 1,000,000) lamports" in legacy and v0. With
  a price and no limit, the runtime's default applies: 200,000 CU per instruction, 3,000 per builtin, at most
  1,400,000. The base fee is 5,000 lamports per signature.
- **Blockhashes expire; durable nonces do not.** A blockhash is usable for "about 60 to 90 seconds" (151 blocks), and
  after `lastValidBlockHeight` a transaction "will NOT ever be processed". A transaction whose first instruction
  advances a durable nonce uses the nonce "in place of" a blockhash, which removes that "mortality".
- **Expiry is common.** It caused 17.72% of failed non-vote transactions in a year of data.
- **Confirmation is changing.** Under Alpenglow, "confirmed and finalized become the same thing"; a separate upgrade
  halves slot times from 400 ms to 200 ms in stages, which would shorten a blockhash's life in seconds. Alpenglow is
  expected on mainnet on Anza's v4.3 schedule.

## Details: what the guard decodes (ADR-009, `docs/SPEC.md` §4)

| Program | Moves value | Denied | Benign |
|---|---|---|---|
| System | Transfer, TransferWithSeed; CreateAccount, CreateAccountWithSeed and CreateAccountAllowPrefund (SIMD-0312), into an allowed destination | Assign, AssignWithSeed, Allocate, AllocateWithSeed, every nonce instruction | — |
| SPL Token, Token-2022 | Transfer, TransferChecked | Approve, SetAuthority, CloseAccount, Burn, MintTo, Freeze, Thaw; Token-2022's extension instructions; p-token's Batch, WithdrawExcessLamports and UnwrapLamports (SIMD-0266) | Revoke, SyncNative, InitializeAccount |
| ComputeBudget, legacy and v0 | — | any ComputeBudget instruction in a v1 message | the limit, price, loaded-data and heap instructions |
| Memo | — | — | any |
| anything else | not decoded: **denied unless allowlisted**, and flagged as opaque even when allowlisted | | |

Built at milestone 2a.3 as `packages/sdk/src/classify.ts`, with one addition the table did not foresee: a
CreateAccountAllowPrefund whose new account is a principal key is denied, because SIMD-0312 says it can brick a funded
wallet.

Token-2022 mints can carry extensions that run other programs (transfer hooks) or grant standing authority (permanent
delegate). A mint with either is denied unless the policy names it, and the operator's check of a mint is point in
time.

## For Solanaut

- **Decode serialized bytes** of every live format, and deny unknown versions.
- **Pin lookup tables** rather than trusting the caller's copy of them.
- **Deny durable nonces** until nonce tracking exists: intents cannot reason about a transaction that never expires.
- **Decide intents by block height**, from a source the mode trusts. Admit a new signature for the same intent only
  once the earlier one has failed for certain, or its `lastValidBlockHeight` has passed.
- **Re-check timing after network upgrades.** No timeout may assume 400 ms slots.

## Related

- [DeFAI on Solana](../defai/_index.md)
- [Gubernaut Keel](../gubernaut/_index.md)
- [Phantom](../competitors/phantom.md)
- `docs/SPEC.md`

## Open questions

- Does `@solana/kit`'s plugin client build v1 by default? Checked at milestone 2a.2.
- Token-2022's mutable extension settings: enumerate them against the spl-token-2022 source (Alpha).
- When Alpenglow and shorter slots reach mainnet, re-measure a blockhash's lifetime in seconds.
