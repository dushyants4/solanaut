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
