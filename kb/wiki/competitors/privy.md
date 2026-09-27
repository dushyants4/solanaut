---
type: entity
status: current
kind: product
created: 2026-09-27
updated: 2026-09-27
---

# Privy wallet policies

**Sources:**
- [Solana policies](../../sources/2026-09-27_privy-solana-policies.md)
- [stateful policies](../../sources/2026-09-27_privy-stateful-policies.md)

Privy, now a Stripe company, runs server wallets for apps and agents, with a policy engine that checks
each signing request.

| | |
|---|---|
| Does | per-transaction Solana rules on program, SOL amount, mint and amount, and recipient |
| Does not | resolve lookup-table addresses ("does not support resolving addresses from Address Lookup Tables"); window totals on Solana |
| Enforces where | the signing service |
| On Solana | yes, per transaction |
| Licence, status | commercial |

## Relation to Solanaut

It complements rather than competes. Its documentation shows two traps Solanaut's design avoids:

1. **Counting a window after signing.** "Aggregation values are updated **after** a request is
   successfully signed", so concurrent requests can all pass. Solanaut reserves at admission.
2. **Lookup tables.** An address rule that must look inside a table fails. Solanaut requires the
   resolved tables, or denies.

This is stated neutrally and dated: it is what Privy's docs said on 2026-09-27, not a claim about how
their product behaves.

## Related

- [competitors](_index.md)
