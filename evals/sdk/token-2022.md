# Token-2022 transfer-fee decoding

The SDK now names discriminator 26 as `TransferCheckedWithFee` only for the
Token-2022 program and treats it as value-moving. Its parser requires the
19-byte layout (discriminator, gross amount, decimals and withheld-fee field)
and the existing checked-transfer account shape; malformed lengths are denied.
The ordinary Token program keeps discriminator 26 denied.

First failure: the classifier had no Token-2022 extension name and treated the
new instruction as unknown. Final focused tests pass 27 cases and typecheck is
green. Regenerate with `node --test packages/sdk/test/classify.test.ts` and
`npm run typecheck`.

## Correction, 2026-10-22

The 2026-10-13 parser had the layout wrong. Token-2022's instruction 26 is its transfer-fee
extension, and its second byte names the sub-instruction: TransferCheckedWithFee is
`[26, 1, amount u64, decimals u8, fee u64]`, 19 bytes, as the program's own `pack` writes it
(`interface/src/extension/transfer_fee/instruction.rs` in github.com/solana-program/token-2022).
The parser checked only the first byte and the length, and read the amount from byte 1:

- the sub-instruction tag became the amount's low byte, so an amount below 2^56 raw units was
  counted about 256 times too large, which over-denies, and an amount of 2^56 or more lost its top
  byte: 2^56 + 5 units was counted as 1,281, under any cap;
- the decimals were read from byte 9, inside the amount;
- every 19-byte instruction 26 counted as a transfer, including the extension's other
  sub-instructions padded to that length, such as SetTransferFee, whose unpacking ignores
  trailing bytes.

Destinations were still enforced: the token account had to be an allowed owner's.

First failure, on the 2026-10-13 code: three tests written first failed for these reasons (an
amount of 5 read as 1,281 with decimals 0, and InitializeTransferFeeConfig named
TransferCheckedWithFee). Now instruction 26 under Token-2022 is named by its sub-instruction, only
TransferCheckedWithFee moves value, its amount is read from byte 2 and its decimals from byte 10,
and the other five sub-instructions are denied by name. The classifier battery passes 29 cases,
and `evals/sdk/token-2022-faults.ts` plants four faults (the amount at the tag, the decimals inside
the amount, any sub-instruction moving value, and Token's own 26 read as the extension), each
caught. The frozen mutation selection now runs 576 tests.

Regenerate with `node --test packages/sdk/test/classify.test.ts` and
`node evals/sdk/token-2022-faults.ts`.
