# ADR-005 · Decode serialized bytes: legacy and v0, System, SPL, Token-2022 and fees; deny the rest

**Status:** accepted 2026-09-27, in the research-foundation plan the human approved. **Partly superseded by
[ADR-009](ADR-009-trust-and-coverage.md)** (2026-09-30): point 2 (v1 is now decoded, and lookup tables are pinned
rather than supplied by the caller), point 3 (an allowlist per instruction replaces the list of decoded
instructions) and the consequence "the caller controls lookup-table contents". Its reversal condition below was met:
v1 went live on mainnet on 2026-09-15, and `@solana/kit` 8 builds it.

## Context

- **The phase-0 describer is too narrow.** It reads web3.js legacy `Transaction` objects and System
  Program transfers only. Allowlisting the Token Program therefore allows any token transfer to anyone
  (`docs/SPEC.md` §10, D6).
- **Agents sign both formats.** Solana Agent Kit's `BaseWallet` signs `Transaction | VersionedTransaction`,
  and the frameworks still build on `@solana/web3.js` 1.x, while `@solana/kit` is the modern line
  ([npm](../kb/sources/2026-09-27_npm-agent-frameworks.md)). A guard tied to one library's objects
  misses the others.
- **v0 transactions reference addresses through lookup tables,** "by its 1-byte index within the table"
  ([Solana docs](../kb/sources/2026-09-27_solana-docs-lookup-tables.md)). Their destinations are
  unknowable without the tables. One major signing service's policies do "not support resolving
  addresses from Address Lookup Tables"
  ([Privy](../kb/sources/2026-09-27_privy-solana-policies.md)).
- **A newer format moves the fee.** v1 transactions exist; they raise the size limit to 4,096 bytes
  and make the priority fee "an absolute lamport total configured in the message settings"
  ([fees](../kb/sources/2026-09-27_solana-docs-fees.md),
  [transactions](../kb/sources/2026-09-27_solana-docs-transactions.md)).
- **Some instructions grant future control:** Approve, SetAuthority, CloseAccount and Assign. Freysa was
  drained by persuading it that its `approveTransfer` function meant something else (M1).

## Decision

1. **Decode the serialized message bytes.** That covers every library and framework.
2. **Legacy and v0 are decoded.** A v0 message whose lookup tables are not all supplied by the caller is
   denied. **v1 and unknown versions are denied** until they are decoded.
3. **System, SPL Token, Token-2022, ComputeBudget and Memo are decoded,** as `docs/SPEC.md` §4
   specifies.
   - Approve, SetAuthority, CloseAccount and Assign are denied as `instruction-denied`.
   - The priority fee is computed and capped per transaction and per window.
4. **Token destinations are checked by owner.** A transfer's destination must be the associated token
   account of an allowed owner for that mint, derived offline, or an address the policy names. A plain
   `Transfer`'s mint is inferred from its source, or the transfer is denied.
5. **Any other program is denied unless allowlisted.** An allowlisted program the guard cannot decode is
   *opaque*: denied by default (`programs.opaque: "deny"`), and flagged in every decision if the
   operator allows it.
6. **Amounts are `bigint`.**

## Consequences

- **Swaps are out of scope.** Jupiter or any DEX is opaque, so an agent that must swap needs the
  operator to allow opaque programs knowingly. The cockpit shows the flag. Decoding swaps and
  simulating transactions (LiteSVM, Surfpool) are post-hackathon.
- **Token-2022 extensions are a residual risk.** Transfer hooks and permanent delegates cannot be seen
  without reading the mint account, and the guard has no RPC. The operator lists only mints it has
  checked. `docs/papers/THREAT-MODEL.md` records this.
- **The caller controls lookup-table contents.** A lying RPC can mislead the guard, and the on-chain
  limit (ADR-006) is the backstop.

## Would show this was wrong

- A framework in scope emits v1 transactions before 2026-10-12. Then v1 decoding moves into H1.
- Agents in the adapters' scope routinely pay into token accounts that are not associated accounts.
  Then the policy names token accounts directly, not only their owners.
