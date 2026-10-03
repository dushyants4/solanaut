# ADR-016 · Token-2022: what the policy pins, what the signer re-reads, and what is only stated

**Status:** **proposed** on 2026-10-03, for the human to accept at milestone 2c.1. It answers TOK-5 in
[docs/SPEC.md](../docs/SPEC.md) §13.3, and is written before milestone 3.3's code.

## Context

- **The threat.** T15: a Token-2022 mint with a transfer hook, a transfer fee or a permanent delegate. In the Beta the
  guard has no RPC, so it reads no extension. The operator lists only mints it has checked, and that check is point in
  time (SPEC §4).
- **What can change after a mint is initialised**, read from the program's source
  ([source note](../kb/sources/2026-10-01_token-2022-authorities-and-extensions.md)):
  - `AuthorityType` has 18 variants, each an authority `SetAuthority` can reassign. Among them: the transfer-fee
    authority, the permanent delegate ("Authority to transfer or burn any tokens for a mint"), the transfer-hook
    program id, the pause authority and the UI-amount scale.
  - A new transfer fee takes effect two epochs after it is set, "to avoid rug pulls at the end of an epoch". Its basis
    points are bounded; its `maximum_fee` is not.
  - The fee is withheld from the amount sent. The recipient gets the amount less the fee.
- **What a transfer hook can do.** It runs with every account of the transfer read-only, and "the signer privileges of
  the sender do not extend to the Transfer Hook program"
  ([source note](../kb/sources/2026-10-03_solana-transfer-hook-guide.md)). It can fail a transfer. It cannot spend
  from the sender with the sender's signature.
- **What a permanent delegate can do.** It moves or burns any holder's tokens of that mint without the holder's
  signature. No guard of the holder's signatures can stop it.

## Decision (proposed)

**Sort each mint extension by what it can do to the principal, and act only where the guard can.**

| Class | Extensions | What can change later | In the Alpha (signer mode) |
|---|---|---|---|
| Takes the principal's tokens without its signature | PermanentDelegate | the delegate | **Not listable by default.** An operator who lists such a mint anyway pins the delegate's address, and a different delegate at admission denies. The policy and the documents say the guard cannot stop the delegate itself |
| Runs another program on each transfer | TransferHook | the hook program id; its extra-account list | the hook program id is pinned, and a different one at admission denies. The hook can fail a transfer, which is reported `failed`; it cannot spend from the principal |
| Withholds part of each transfer | TransferFeeConfig | the fee, two epochs after it is set | the policy pins a ceiling on basis points and on the maximum fee. The fee in force and any fee scheduled to replace it must both be within it, or the proposal is denied. The caps count the gross amount, which is what leaves the principal |
| Stops transfers | Pausable, DefaultAccountState, the freeze authority, NonTransferable | the pause; the default state | no rule: a paused or frozen transfer fails and is reported `failed`. These cost availability, not funds |
| Hides amounts | ConfidentialTransferMint, ConfidentialTransferFeeConfig, ConfidentialMintBurn | the auditor; approvals | no change: confidential instructions stay denied by rule 9, because the guard cannot read their amounts |
| Display and metadata | InterestBearingConfig, ScaledUiAmount, MetadataPointer, TokenMetadata, GroupPointer, TokenGroup, GroupMemberPointer, TokenGroupMember | the rate; the UI multiplier; the pointers | no rule: the caps are in base units, which these do not change. The dashboard shows base units beside any UI amount |
| Burns and closes | PermissionedBurn, MintCloseAuthority | the authorities | no rule: burns are denied instructions (§4), and a mint closes only at zero supply |

1. **The policy.** Each Token-2022 entry names its full extension set, as the operator checked it. It also names the
   pinned values its set requires: `transferFee` (`maxBasisPoints`, `maxFee`), `transferHook` (`programId`), and
   `permanentDelegate` (`address`). Rule 0 refuses an entry missing a value its set requires.
2. **At admission, in signer mode.** The signer reads each listed Token-2022 mint a proposal touches, at `confirmed`.
   - An extension set that differs from the pinned one denies, as `mint-extensions-changed`.
   - A pinned value that differs denies, as `mint-settings-changed`.
   - Both are new names under rule 11, the mint rule.
3. **Binding the read to the landing.** A setting can change between the read and the transaction's landing. When
   milestone 3.4's Lighthouse assertions exist, the signer appends one on the mint's pinned fields, so a change in
   between fails the transaction on-chain. Until then, the window from read to landing is stated.
4. **SDK mode is unchanged:** no RPC, so the listing is the operator's point-in-time check, as the Beta states.
5. **PermissionedBurn** (extension prefix 46) appears on the program's `main` branch. Before anything relies on it,
   it is checked against the program deployed on the cluster in use.

## Consequences

- **What it stops.** A listed mint whose hook program, delegate or fee ceiling changes after listing. T15's residual
  narrows to:
  - a permanent delegate the operator chose to accept;
  - a fee within the ceiling the operator chose;
  - a hook failing a transfer;
  - the read-to-landing window, until 3.4.
- **The policy grows**, and is validated at creation (rule 0). Beta policies list no Token-2022 mints in their tests,
  so none breaks.
- **The classifier.** A TransferChecked to a hooked mint carries the hook's extra accounts. Milestone 3.3 decodes them
  as read-only accounts the transfer passes through, and still denies any extra signer (rule 6).
- **Not decided here:**
  - confidential transfers, which stay denied;
  - Token-2022's account extensions, such as MemoTransfer and CpiGuard, which affect the receiving account rather
    than the principal's outflow.
