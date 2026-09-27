---
type: source
status: current
url: "https://dl.acm.org/doi/10.1145/317087.317089"
title: "Secure audit logs to support computer forensics"
publisher: "ACM Transactions on Information and System Security 2(2), 159–176 (Schneier and Kelsey)"
published: "1999-05"
fetched: 2026-09-27
checked: first-hand
created: 2026-09-27
updated: 2026-09-27
---

# Tamper-evident audit logs

## Key facts

- The paper describes a computationally cheap method that makes all log entries written before the
  logging machine is compromised impossible for the attacker to read, and "impossible to modify or
  destroy undetectably". The phrasing is the ACM abstract's, as the search result summarised it.

## What it supports

- `design/ADR-004-admission-and-receipts.md`: Solanaut's decision log chains each entry to the hash of
  the one before, so a rewritten history is detectable on replay.
- [kb/wiki/security/admission-pattern.md](../wiki/security/admission-pattern.md)

## Caveats

- **Read at abstract level only.** Solanaut's hash chain is the simplest form of the idea, not the
  paper's scheme: it has no forward-secure keys, so it detects rewriting but does not keep entries
  secret. A chain rewritten wholesale by someone holding the whole log is caught only if its head
  was anchored somewhere else first. That is why the log head is anchored on-chain (a stretch goal).
