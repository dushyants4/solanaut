# The instruction classifier: shown failing, then passing

Milestone 2a.3 in [docs/ROADMAP.md](../../docs/ROADMAP.md): an allowlist per instruction for System, SPL Token,
Token-2022, ComputeBudget and Memo; the durable-nonce and other-signer denials; the fee rule, with defaults, v1's
config, base fees and tips ([docs/SPEC.md](../../docs/SPEC.md) §4). Run on 2026-09-30 with Node 26.7.0,
`@solana/kit` 8.4.0, `@solana-program/system` 0.15.0, `@solana-program/token` 0.17.0 and
`@solana-program/compute-budget` 0.19.0.

| File | What it is |
|---|---|
| `packages/sdk/src/classify.ts` | `effectsOf(bytes, context)`: decode, resolve, then report every outflow, denial, fee and the intent key |
| `packages/sdk/src/pda.ts` | the ed25519 curve check, program-derived addresses, and associated token accounts, computed offline |
| `packages/sdk/src/canonical.ts` | canonical JSON and SHA-256, for the intent key |
| `packages/sdk/test/classify.test.ts` | 26 tests |

The instructions in the tests are built by the Solana program clients and compiled by kit into each message version.
None of them is built by Solanaut. The clients' own identifiers are the reference for every instruction's name, across
all 256 single-byte discriminators of the Token and ComputeBudget programs, and System's 0 to 20.

The classifier reports and decides nothing. The rules, in their order, are applied at admission (milestone 2a.5).

## 1. Failing first

The 25 tests written first ran against a stub whose functions threw `not implemented`:

```
ℹ tests 25   ℹ pass 1   ℹ fail 24
```

The one pass was a sanity check of the program id constants, which uses only the base58 codec from 2a.2.

The first full run then failed one test, and the test was wrong. It expected a Token-program transfer to the
treasury's Token-program account not to name the treasury. Naming it is correct. The test was rewritten to check what
it meant to check: a Token-program transfer to a Token-2022 account names no owner.

The 26th test, for rule 6's input, was added later. It failed first (`ℹ pass 25   ℹ fail 1`), then
`otherSigners` was added to the effects.

## 2. Then passing

```
✔ the curve check and program-derived addresses agree with web3.js on random inputs
✔ associated token accounts are derived as the token client derives them, for Token and Token-2022
✔ System Transfer is value-moving: the destination and lamports are counted, in every version
✔ durable nonces: AdvanceNonceAccount first marks the message, and every nonce instruction is denied
✔ Token: every discriminator has the class the spec gives it, under both token programs
✔ fees, legacy and v0: price × limit, rounded up; the default limit when none is set; no price, no fee
✔ fees, v1: the priority fee is the config's lamport total, and any ComputeBudget instruction is a denied decoy
✔ the intent key ignores the blockhash, the fees, memos and the version, and follows what moves
…
ℹ tests 61   ℹ pass 61   ℹ fail 0        (npm test: the classifier's 26, the decoder's 24, the pin command's 2, the guard's 9)
```

## 3. Ten planted bugs, ten caught

| Planted bug | Failing tests |
|---|---|
| nonce instructions not denied | 1 |
| Token Approve treated as benign | 2 |
| p-token's Batch treated as benign | 1 |
| the priority fee rounded down | 1 |
| System not counted as a builtin for the default limit | 1 |
| tips counted as payments | 1 |
| the intent key includes every program, so a fee bump becomes a new intent | 1 |
| a v1 ComputeBudget decoy allowed | 1 |
| CreateAccountAllowPrefund allowed to assign a principal account | 1 |
| the curve check keeps the sign bit | 4 |

## 4. Decided while building

These are recorded in [docs/SPEC.md](../../docs/SPEC.md) §4:
- CreateAccountAllowPrefund, read from SIMD-0312, is denied when the new account is a principal key.
- p-token's Batch, WithdrawExcessLamports and UnwrapLamports are denied.
- A multisig token authority is denied.
- Two ComputeBudget instructions of one kind are denied.
- Data must fit its instruction's layout exactly.
- Only System and ComputeBudget count as builtins for the default compute limit.

## Regenerate

- `npm test`
- `node --test packages/sdk/test/classify.test.ts`
