---
type: source
status: current
url: "https://docs.stripe.com/api/idempotent_requests"
title: "Idempotent requests"
publisher: "Stripe"
published: "undated"
fetched: 2026-09-27
checked: first-hand
created: 2026-09-27
updated: 2026-09-27
---

# Idempotency keys

A well-known payments precedent for Solanaut's *intents*.

## Key facts

- The API supports idempotency "for safely retrying requests without accidentally performing the same
  operation twice".
- It saves "the resulting status code and body of the first request made for any given idempotency
  key… Subsequent requests with the same key return the same result".
- It "compares incoming parameters to those of the original request and errors if they're not the
  same to prevent accidental misuse."

## What it supports

- `design/ADR-004-admission-and-receipts.md` and `docs/SPEC.md`, intents: a re-proposal carrying the
  same intent key never becomes a second payment while the first could still land.
- [kb/wiki/security/admission-pattern.md](../wiki/security/admission-pattern.md)

## Caveats

- **Solana differs.** A transaction whose blockhash expired can never land, so an expired intent may
  be re-signed safely ([Solana confirmation docs](2026-09-27_solana-docs-confirmation.md)). The intent
  rule uses that, where Stripe relies on its server remembering keys.
