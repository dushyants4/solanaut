# ADR-018 · Bounding opaque programs: simulate, then assert the principal's floor on-chain

**Status:** **accepted** by the human on 2026-10-05, with the Alpha's scope (milestone 2c.1); proposed on 2026-10-03. It answers OPQ-7 in
[docs/SPEC.md](../docs/SPEC.md) §13.4, and is written before milestone 3.4's code.

## Context

- **The threat.** T3: an allowlisted program that moves funds by cross-program invocation, such as a swap to someone
  else. The guard does not decode such programs (they are *opaque*, §4), so in the Beta they are denied unless the
  operator allows them knowingly.
- **What milestone 3.4 must show:** a Jupiter route bounded on a Surfpool mainnet fork; the route altered to drain
  fails on-chain (OPQ-6).
- **What the tools can do**, read first-hand:
  - **Simulation** ([source note](../kb/sources/2026-10-03_solana-rpc-simulatetransaction.md)):
    `simulateTransaction` returns the accounts asked for, up to the transaction's account count, with the compute
    used and an error if it failed.
  - **Lighthouse** ([source note](../kb/sources/2026-09-30_lighthouse-program.md)): an assertion program, the same id
    on devnet and mainnet. It asserts a token account's amount, owner, delegate and close authority, Token-2022 included,
    and an account's lamports. `GreaterThanOrEqual` is among its operators, and Multi forms batch assertions into one
    instruction. It also has memory-write instructions, which fund and write an account.
- **Why a simulation alone is not enough.** It reads one slot's state; what lands later can do something else. An
  assertion fails the transaction on-chain if it does.

## Options

| | Approach | Problem |
|---|---|---|
| A | keep opaque programs denied | no swaps, ever |
| B | simulate and admit if the result is within policy | what lands can differ from what was simulated |
| C | simulate, then append assertions that hold the principal to the simulated result, and sign the bytes with them | more bytes and compute; the guard modifies the message |
| D | decode each opaque program | per-program work without end; SPEC §1 rules out decoding swap programs |

## Decision (accepted 2026-10-05)

**C. A as the fallback**, if 3.4's gate cannot be met (RK6).

1. **Which accounts are held.** Every account the transaction writes that the principal controls:
   - the principal's own keys, for lamports;
   - every token account whose owner or delegate is a principal key, read at `confirmed`.
2. **Simulate.**
   - Signer mode, at `confirmed`, with `sigVerify` false and the message's own blockhash kept, so the bytes simulated
     are the bytes admitted.
   - The held accounts are asked for, with the slot recorded. Their state before the simulation is read at that slot.
3. **Check the result against the policy.**
   - Each held account's loss counts as an outflow of SOL or of its mint, against the per-transaction and window caps:
     the lamports fall, or the token amount falls.
   - No held account may change its owner, delegate or close authority.
   - A simulation that fails, an RPC that does not answer, or a result that disagrees with the decoded effects (the
     System and token instructions the guard can read) denies: rule 19 for the first two, the decoded rule for the
     last.
4. **Append the floor.** After the last instruction, Multi assertions:
   - for each held token account: `Amount >= ` its simulated balance after the transaction; `Owner`, `Delegate` and
     `CloseAuthority` `Equal` their values before;
   - for each held system account: `Lamports >= ` its simulated balance after the transaction, less the fees counted
     at admission.

   So on-chain the principal can lose no more than the simulation showed, whatever the opaque program does, and in
   whatever order the transaction lands.
5. **The receipt binds the bytes with the assertions.**
   - In signer mode the signer compiles the extended message, signs it, and records the assertion set and the
     simulation slot as inputs, so `replay` rebuilds the same bytes.
   - The agent never supplies the assertions.
6. **Limits.**
   - If the assertions push the transaction past its size (1,232 bytes; 4,096 for v1) or its compute budget, the
     proposal is denied, never sent unbounded (OPQ-5).
   - Raising the compute-unit limit to fit them changes the priority fee, so the fee rules run again.
7. **Only read-only assertions** are appended or admitted. MemoryWrite and MemoryClose are denied until they have a
   rule (OPQ-4, T28).
8. **SDK mode cannot do this:** there is no RPC to simulate on. Opaque programs stay as in the Beta: denied, or
   allowed knowingly and unbounded, stated.

## Consequences

- **What it stops.** An opaque program taking more from the principal than the simulation showed, or changing who
  controls a principal account, at any ordering on-chain. T3's residual narrows to:
  - what the simulation itself showed and the policy allowed: a bad price within the caps is still a bad price;
  - the principal's accounts that the transaction does not write. The program cannot touch them anyway, without
    their authority.
- **What it costs.** One simulation and one or two account reads per opaque proposal, more bytes, and more compute.
  Large routes may not fit, and are then denied.
- **Assumptions to test first in 3.4:**
  - that `simulateTransaction`'s `accounts` are the state after the simulated execution: the page says "Accounts
    requested";
  - that a Jupiter route with the assertions appended still fits.
- **Lighthouse's audit** was reported by search results, not read (source note). It is read before mainnet, and named
  in `docs/RISKS.md` (RK6).
- **Not decided here:**
  - the slippage the operator accepts on the side the principal receives, which is a pricing question, not a drain;
  - bundles of several transactions, which are denied.
