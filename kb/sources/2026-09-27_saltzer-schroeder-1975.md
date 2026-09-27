---
type: source
status: current
url: "https://www.cs.virginia.edu/~evans/cs551/saltzer/"
title: "The Protection of Information in Computer Systems"
publisher: "Proceedings of the IEEE (Saltzer and Schroeder); hosted at the University of Virginia"
published: "1975"
fetched: 2026-09-27
checked: first-hand
created: 2026-09-27
updated: 2026-09-27
---

# Saltzer and Schroeder's design principles

## Key facts

- **Economy of mechanism:** "Keep the design as simple and small as possible."
- **Fail-safe defaults:** "Base access decisions on permission rather than exclusion."
- **Complete mediation:** "Every access to every object must be checked for authority."
- **Separation of privilege:** "A protection mechanism that requires two keys to unlock it is more
  robust and flexible than one that allows access to the presenter of only a single key."
- **Least privilege:** "Every program and every user of the system should operate using the least
  set of privileges necessary to complete the job."

## What it supports

- `design/ADR-004-admission-and-receipts.md`: deny by default, an allowlist rather than a denylist,
  mediating every signature, a release that needs a second key.
- [kb/wiki/security/admission-pattern.md](../wiki/security/admission-pattern.md)

## Caveats

- None. A foundational and stable text.
