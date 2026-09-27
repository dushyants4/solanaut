---
type: topic
status: current
created: 2026-09-27
updated: 2026-09-27
---

# The admission pattern: propose, admit, sign

**Sources:**
- [NIST: reference monitor](../../sources/2026-09-27_nist-reference-monitor.md)
- [Saltzer and Schroeder](../../sources/2026-09-27_saltzer-schroeder-1975.md)
- [Schneier and Kelsey](../../sources/2026-09-27_schneier-kelsey-secure-audit-logs.md)
- [Stripe idempotency](../../sources/2026-09-27_stripe-idempotency.md)
- [Solana confirmation](../../sources/2026-09-27_solana-docs-confirmation.md)
- [Privy's stateful policies](../../sources/2026-09-27_privy-stateful-policies.md)

How Solanaut decides whether an agent's transaction may be signed. It is a reference monitor built
from well-known parts, recorded as a decision in `design/ADR-004-admission-and-receipts.md`.

## Key takeaways

1. **Three roles.** The agent **proposes**, the guard **admits**, the signer **executes**. Nothing
   reaches the key without passing the guard ("complete mediation").
2. **Deny by default.** A program, destination or mint is allowed only if the policy names it
   ("fail-safe defaults": permission, not exclusion).
3. **The controller only restricts.** Keel's posture can turn an ALLOW into a DENY, never the reverse.
   A calm posture is not evidence that a transaction is safe.
4. **Ordered gates, stable reasons.** The first failing gate is the reason, so the same proposal always
   fails the same way.
5. **A receipt binds the decision to the exact bytes.** It carries the message's hash, an expiry
   (`lastValidBlockHeight`), the policy's hash and Keel's identity, and it is used once. The signer
   signs nothing without one, so nothing can change between check and signature.
6. **Reserve at admission.** Budgets are counted when a transaction is allowed, not when it confirms:
   counting after signing lets concurrent requests all pass. An outcome that is still **unknown**
   keeps its reservation.
7. **Intents.** Each logical payment has a key. The same intent may be signed again only once its
   earlier attempt has definitively failed or its blockhash has expired. The idea is Stripe's
   idempotency, adapted to Solana's expiry.
8. **A latch.** Repeated denials or a REGROUND latch the guard. Only the operator's key releases it,
   never the agent's ("separation of privilege").
9. **A hash-chained log with replay.** Each decision records the hash of the previous one, and replay
   recomputes every decision from the proposals. A rewritten history is detected. The chain's head is
   anchored on-chain (a stretch goal) so a wholesale rewrite is detected too.
10. **Every gate shown failing** on an injected fault before it is trusted (`evals/README.md`).

## For Solanaut

- Items 1–7 are the SDK core in H1. Item 8 is H1 and H2. Item 9 is H1, with the anchor in H3 as a
  stretch.
- **The honest limit:** in the agent's own process, a compromised agent can skip the guard and use the
  key. Hence the signer process and the on-chain limits
  ([security](_index.md)).

## Related

- [security](_index.md)
- [Solana transactions](../solana/_index.md)
- [Gubernaut Keel](../gubernaut/_index.md)
