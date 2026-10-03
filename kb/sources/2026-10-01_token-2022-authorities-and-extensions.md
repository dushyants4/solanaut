---
type: source
status: current
url: "https://github.com/solana-program/token-2022"
title: "solana-program/token-2022: the interface's AuthorityType and ExtensionType, and the transfer-fee processor"
publisher: "Solana Program (GitHub)"
published: "undated (main branch)"
fetched: 2026-10-01
checked: first-hand
created: 2026-10-01
updated: 2026-10-01
---

# Token-2022: which mint settings can change after initialisation

The Token-2022 program's own source, read for the open question in `docs/SPEC.md` §12: which extension settings an
authority can change after a mint is initialised, so a listed mint can change under the operator.

Files read:
- `interface/src/instruction.rs`, for `AuthorityType` and the extension instruction prefixes;
- `interface/src/extension/mod.rs`, for `ExtensionType`;
- `interface/src/extension/transfer_fee/mod.rs` and `program/src/extension/transfer_fee/processor.rs`, for transfer fees.

## Key facts

- **`AuthorityType` has 18 variants**, each an authority that `SetAuthority` (discriminator 6) can reassign:
  - MintTokens, FreezeAccount, AccountOwner, CloseAccount;
  - TransferFeeConfig, WithheldWithdraw, CloseMint, InterestRate;
  - PermanentDelegate ("Authority to transfer or burn any tokens for a mint");
  - ConfidentialTransferMint, TransferHookProgramId ("Authority to set the transfer hook program id");
  - ConfidentialTransferFeeConfig, MetadataPointer, GroupPointer, GroupMemberPointer;
  - ScaledUiAmount, Pause ("Authority to pause or resume minting / transferring / burning");
  - PermissionedBurn.
- **Extension instruction prefixes** include:
  - TransferFee (26), ConfidentialTransfer (27), DefaultAccountState (28), MemoTransfer (30);
  - InterestBearingMint (33), CpiGuard (34), TransferHook (36), ConfidentialTransferFee (37);
  - MetadataPointer (39), GroupPointer (40), GroupMemberPointer (41), ConfidentialMintBurn (42);
  - ScaledUiAmount (43), Pausable (44), PermissionedBurn (46).
- **`ExtensionType`'s mint extensions:** TransferFeeConfig, MintCloseAuthority, ConfidentialTransferMint,
  DefaultAccountState, NonTransferable, InterestBearingConfig, PermanentDelegate, TransferHook,
  ConfidentialTransferFeeConfig, MetadataPointer, TokenMetadata, GroupPointer, TokenGroup, GroupMemberPointer,
  TokenGroupMember, ConfidentialMintBurn, ScaledUiAmount, Pausable and PermissionedBurn ("Burning requires authority
  approval").
- **A new transfer fee waits two epochs:** "let newer_fee_start_epoch = epoch.saturating_add(2);", commented "set two
  epochs ahead to avoid rug pulls at the end of an epoch" (`process_set_transfer_fee`). The basis points are bounded by
  `MAX_FEE_BASIS_POINTS`, and `maximum_fee` has no bound there.
- **The fee is withheld from the amount sent:** the recipient gets the pre-fee amount less the fee, and the fee is
  withheld in the recipient's account "to be harvested to the mint" (`calculate_post_fee_amount`, `TransferFeeAmount`).

## What it supports

- [ADR-016](../../design/ADR-016-token-2022-settings.md), and requirements TOK-1, TOK-2 and TOK-5 in `docs/SPEC.md` §13.3.
- Threat T15 in `docs/papers/THREAT-MODEL.md`.

## Caveats

- Read from the `main` branch on 2026-10-01, not from a tagged release. The deployed program on a given cluster may
  lag `main`: PermissionedBurn (46) in particular must be checked against the deployed program before it is relied on.
- The numeric `ExtensionType` values were not recorded here; pin by name, and derive the numbers from the client
  library the code uses.
- What each authority's change does at runtime (for example, whether a pause fails a transfer or only a mint) was not
  read per processor, except for the transfer fee.
