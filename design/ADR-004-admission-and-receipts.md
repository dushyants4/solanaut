# ADR-004 · Propose, admit, sign: receipts bind every decision to the bytes signed

**Status:** accepted 2026-09-27, in the research-foundation plan the human approved. It refines
ADR-001; it does not replace it.

## Context

- **What the phase-0 guard lacks.** It returns a `Decision` for a `Proposal`. Nothing ties that
  decision to the bytes the caller later signs, no log exists, and nothing stops a caller from
  re-signing an attempt that could still land. Its defects are listed in `docs/SPEC.md` §10.
- **How losses happen.** The documented losses of agent wallets come from authority held by the model,
  from lost state, and from keys in the agent's process
  ([incidents](../kb/wiki/defai/incidents.md), `docs/CLAIMS.md` M1–M7). None of them needed a clever
  jailbreak, and defences inside the model are weak once its context is poisoned (M3).
- **The textbook answer is a reference monitor:** a mechanism "always invoked (i.e., complete
  mediation), tamperproof, and small enough to be subject to analysis and tests"
  ([NIST SP 800-53](../kb/sources/2026-09-27_nist-reference-monitor.md)). Its classic principles are
  fail-safe defaults, complete mediation, least privilege and separation of privilege
  ([Saltzer and Schroeder, 1975](../kb/sources/2026-09-27_saltzer-schroeder-1975.md)).
- **Counting a budget after signing is unsafe:** "multiple concurrent requests may all pass policy
  evaluation before any of their values are recorded"
  ([Privy's docs](../kb/sources/2026-09-27_privy-stateful-policies.md)).
- **When a re-sign is safe:** a Solana transaction whose blockhash has expired "will NOT ever be
  processed" ([Solana docs](../kb/sources/2026-09-27_solana-docs-confirmation.md)). Before that, a
  re-sign can pay twice.

## Decision

1. **Three roles.** The agent proposes, the guard admits, the signer executes. The signer signs nothing
   without a receipt.
2. **A receipt is an allowed decision bound to the exact bytes:** the message's SHA-256, an expiry
   (`lastValidBlockHeight`), the policy's hash and Keel's identity. It is usable once. The guard checks
   and signs the same snapshot of the bytes, so nothing can change between the two.
3. **Deny by default, in a fixed order.** Programs, destinations and mints are allowed only if named.
   The first failing rule is the reason (`docs/SPEC.md` §5), and any error denies.
4. **Keel only restricts.** REGROUND denies, and INHIBIT tightens the per-transaction caps by
   `temperatureMax`. A DEFAULT posture never allows what the policy denies. Posture is advice, never
   authorisation.
5. **Reserve at admission.** Budgets are counted when an amount is allowed. An unknown outcome keeps its
   reservation.
6. **Intents.** A new attempt at the same logical payment is admitted only once the earlier attempt has
   definitively failed or expired. The idea is idempotency keys
   ([Stripe](../kb/sources/2026-09-27_stripe-idempotency.md)), adapted to Solana's expiry.
7. **A latch.** Repeated denials or a REGROUND latch the guard. Only the operator's key releases it,
   never the agent's (separation of privilege).
8. **A hash-chained log with replay.** Each decision carries the previous one's hash, and replay
   recomputes every decision, so a rewritten history is detectable
   ([Schneier and Kelsey, 1999](../kb/sources/2026-09-27_schneier-kelsey-secure-audit-logs.md)).
   Anchoring the head on-chain (ADR-006, P2) also catches a wholesale rewrite.
9. **Three deployment modes,** each stated with what it cannot do:
   - the SDK in-process stops a fooled or confused model, but not a compromised process;
   - a signer process keeps the key away from the agent;
   - the on-chain spending limit bounds a stolen key.

## Consequences

- **The public API changes.** The guard takes serialized bytes and returns receipts. Phase 0's
  `evaluate(Proposal)` becomes internal, a breaking change before any release.
- **More to test.** Every rule, the receipt checks, intents, the latch and replay each get a failing
  test first (`docs/SPEC.md` §11).
- **The cockpit reads the log**, and the log is the evidence behind every number the pitch states.
- **In-process honesty.** The README and the pitch say what the in-process mode cannot do.

## Would show this was wrong

- Receipts or intents make adoption so awkward that the one-line wrappers cannot hide them.
- Replay cannot be made deterministic across Node versions, for example because hashing or
  canonical-JSON behaviour differs between them.
