---
type: topic
status: current
created: 2026-09-27
updated: 2026-09-27
---

# Solana transactions, as a firewall must read them

**Sources:**
- [transactions](../../sources/2026-09-27_solana-docs-transactions.md)
- [lookup tables](../../sources/2026-09-27_solana-docs-lookup-tables.md)
- [fees](../../sources/2026-09-27_solana-docs-fees.md)
- [confirmation](../../sources/2026-09-27_solana-docs-confirmation.md)
- [failed transactions](../../sources/2026-09-27_arxiv-solana-failed-transactions.md)

What a transaction firewall has to understand about a Solana transaction before it can decide
anything about it.

## Key takeaways

- **Three formats.** Legacy, v0 (with lookup tables) and v1 (up to 4,096 bytes; the priority fee moves
  into the message). The standard size limit is 1,232 bytes.
- **Lookup tables hide addresses.** A v0 transaction references addresses "by its 1-byte index
  within the table". Without the table's contents, its destinations are unknowable.
- **The priority fee is computable:** "ceil(compute_unit_price * compute_unit_limit / 1,000,000)
  lamports", from the ComputeBudget instructions (legacy and v0). The base fee is 5,000 lamports per
  signature.
- **Blockhashes expire.** One is usable for "about 60 to 90 seconds" (151 blocks). After
  `lastValidBlockHeight`, a transaction "will NOT ever be processed", so re-signing is safe only then.
- **Expiry is common.** It caused 17.72% of failed non-vote transactions in a year of data.

## Details: what the guard decodes (ADR-005)

| Program | Instructions that matter | Why |
|---|---|---|
| System | Transfer, TransferWithSeed, CreateAccount (its lamports), Assign | they move SOL, or hand an account to another program |
| SPL Token, Token-2022 | Transfer, TransferChecked, Approve, SetAuthority, CloseAccount | they move tokens, or grant someone else future control |
| ComputeBudget | SetComputeUnitLimit, SetComputeUnitPrice | the priority fee |
| Memo | any | harmless, but named |
| anything else | not decoded | **denied unless allowlisted**, and flagged as opaque even when allowlisted |

Token-2022 mints can carry extensions that run other programs (transfer hooks) or grant standing
authority (permanent delegate). A mint with either is denied unless the policy names it.

## For Solanaut

- **Decode serialized bytes**, not one library's objects. That covers web3.js, `@solana/kit` and any
  framework.
- **Deny v1 and unknown versions** until they are decoded: a v1 fee lives where an instruction decoder
  would never look.
- **Decide intents by block height.** Admit a new signature for the same intent only once the earlier
  one has failed for certain, or its `lastValidBlockHeight` has passed.

## Related

- [DeFAI on Solana](../defai/_index.md)
- [Gubernaut Keel](../gubernaut/_index.md)
- `docs/SPEC.md`

## Open questions

- v1's rollout date and SIMD number: read the versioned-transactions page in H1.
- Token-2022's full list of risky extensions: enumerate in H1 against the spl-token-2022 source.
