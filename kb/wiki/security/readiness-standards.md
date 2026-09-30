---
type: topic
status: current
created: 2026-09-30
updated: 2026-09-30
---

# Readiness standards: what a certified release rests on

**Sources:**
- [npm trusted publishing](../../sources/2026-09-30_npm-trusted-publishing.md)
- [Solana verified builds](../../sources/2026-09-30_solana-verified-builds.md)
- [SEAL Safe Harbor, via-agent](../../sources/2026-09-30_seal-safe-harbor.md)
- [OWASP Top 10 for LLM Applications](../../sources/2026-09-30_owasp-llm-top10.md)
- [OWASP Top 10 for Agentic Applications, via-agent](../../sources/2026-09-30_owasp-agentic-top10.md)
- [Alpenglow](../../sources/2026-09-30_solana-alpenglow.md)

The external standards `docs/READINESS.md` builds on, each with what it does and does not prove.

## Key takeaways

- **npm trusted publishing** has been generally available since July 31, 2025. It publishes from CI without long-lived
  tokens and attaches provenance attestations automatically; it needs npm 11.5.1 or later.
- **A verified build** proves a deployed program matches its source, "NOT that your code is secure". Programs under a
  Squads upgrade authority can be verified too.
- **OWASP's 2025 list for LLM applications** names Prompt Injection (LLM01) and Excessive Agency (LLM06). Solanaut
  bounds the second, and contains rather than solves the first.
- **OWASP's agentic list** was published on December 9, 2025. Its entry names are known here only from secondary
  summaries.
- **SEAL Safe Harbor** covers whitehat rescues during an active exploit, and SEAL 911 is an emergency line
  (via-agent).
- **Network upgrades move timing.** Under Alpenglow, confirmed and finalized become the same, and slot times are being
  halved by a separate upgrade.

## For Solanaut

- Milestone R.4 in `docs/READINESS.md` adopts trusted publishing, and a verified build for `solanaut_anchor`.
- The word "certified" waits for the audit and these attestations (`docs/CLAIMS.md` §4).
- *Inference:* SOC 2 or ISO 27001 matter only if a hosted service is launched.

## Related

- [Agent-wallet security](_index.md)
- [Solana transactions](../solana/_index.md)
- `docs/READINESS.md`

## Open questions

- Read OWASP's agentic document itself before quoting its entries.
- Re-read SEAL's Safe Harbor page first-hand before citing it anywhere public.
