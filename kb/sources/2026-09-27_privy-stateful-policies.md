---
type: source
status: current
url: "https://docs.privy.io/controls/policies/stateful-policies"
title: "Stateful policies"
publisher: "Privy (a Stripe company)"
published: "undated"
fetched: 2026-09-27
checked: first-hand
created: 2026-09-27
updated: 2026-09-27
---

# Privy's stateful (windowed) policies

## Key facts

- **Window length:** a "minimum value is `3600` (1 hour), and maximum is `259200` (72 hours)."
- **Chains:** only Ethereum methods are listed (`eth_signTransaction`, `eth_signUserOperation`);
  Solana is not mentioned.
- **Timing:** "Aggregation values are updated **after** a request is successfully signed, not
  before."
- **Concurrency:** "multiple concurrent requests may all pass policy evaluation before any of their
  values are recorded."

## What it supports

- [kb/wiki/competitors/privy.md](../wiki/competitors/privy.md)
- `docs/SPEC.md`, reserve at admission: a window cap counted after signing can be overrun by
  concurrent requests.

## Caveats

- Vendor documentation, as it read on 2026-09-27.
