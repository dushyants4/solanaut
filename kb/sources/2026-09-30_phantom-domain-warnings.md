---
type: source
status: current
url: "https://docs.phantom.com/developer-powertools/domain-and-transaction-warnings"
title: "Domain and transaction warnings"
publisher: "Phantom (docs.phantom.com)"
published: "undated"
fetched: 2026-09-30
checked: first-hand
created: 2026-09-30
updated: 2026-09-30
---

# What Phantom shows for a new dApp domain

Read to plan a hosted dashboard that asks Phantom for signatures.

## Key facts

- A new domain shows: "This domain is new or has not been reviewed yet. Proceed with caution."
- Generally the warning disappears after a few days; if it persists beyond one week, a developer requests a review through Phantom's form.
- Native Android apps verify their identity through a Digital Asset Links file.

## What it supports

- [ADR-011](../../design/ADR-011-phantom-roles-and-dashboard.md), point 5.
- `docs/ROADMAP.md`, milestone 5.1, and `docs/READINESS.md`.

## Caveats

- How localhost or devnet dApps are treated is not documented.
