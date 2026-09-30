# SUBMISSION.md — what Colosseum needs, and who does what

> **Draft 2** · 2026-09-30 · owner: **the human (T4)**, drafted by the archivist · for: the human ·
> not public. Deadline: **2026-10-12, 11:59pm PT**. Sources: the official rules (`docs/HACKATHON.md`),
> [the FAQ](../../kb/sources/2026-09-27_colosseum-faq.md) and
> [the World's Fair page](../../kb/sources/2026-09-27_colosseum-worldsfair.md).

## Checklist

| Item | Requirement | Status | Whose |
|---|---|---|---|
| Project page | the draft at colosseum.com/arena/projects/solanaut: name, category (Security Tools), description, GitHub link | **draft created 2026-09-27** | the human |
| Project details | seven fields still empty in the editor | answers drafted below; the field names to confirm with `tools/colosseum_entry.mjs inspect` | the human |
| Pitch video | "two-to-three-minute presentation video" | script: `PITCH.md` | the human records it |
| Demo video | "no more than three minutes" | script: `DEMO.md` | the human records it |
| Repository access | "private repositories are allowed if access is granted to hackathon@colosseum.com"; open source is encouraged | private today | the human: make it public, or grant access |
| Licence | none yet; needed before making it public | Apache-2.0 would match Gubernaut's | the human |
| Prior-work disclosure | "disclose all relevant past development work in the submission form" | **corrected text below** | the human submits it |
| Live product link | the dashboard on devnet, or the repository | after milestone 2a.10 (`docs/ROADMAP.md`) | the human |
| Team profile | every member registered on colosseum.com (rules §6) | — | the human |
| The submission itself | one per team, uploaded by the team leader | — | **the human, at the moment** |

## The prior-work disclosure (corrected draft)

**Corrected 2026-09-27.** The earlier draft in `docs/HACKATHON.md` said "public since July 2026" of
`@gubernaut/core`, and "Everything in this repository was written during the contest period". Neither
was accurate: `@gubernaut/core` was first published on 2026-08-07 [G6], and the office tooling was
adapted from earlier private work (`plugins/VENDORED.md`).

> Solanaut depends on Gubernaut Keel (`@gubernaut/core` 1.0.1, Apache-2.0), an open-source controller
> by the same author, used unmodified from npm. Gubernaut was first released publicly on 2026-07-29,
> and `@gubernaut/core` was published on 2026-08-07. Gubernaut's earlier public work includes stopping
> an ElizaOS agent's failing on-chain retry loop on a local EVM devnet (July 2026); none of it targets
> Solana.
>
> The repository's development tooling (the agent seats in `plugins/`, the procedures in `workflows/`,
> and four scripts in `tools/`) was adapted from the author's earlier private agent-workflow project,
> as `plugins/VENDORED.md` records. It is not part of the product.
>
> Solanaut's product code (`packages/`, `apps/`) and documents were written during the contest period,
> starting 2026-09-27. Solanaut composes with the Squads v4 multisig program on devnet, and depends on
> `@solana/web3.js`.

## Project details: draft answers

Mapped to what the judges weigh. Paste only what the human approves. Where a field wants more than a
line, the long form is the written pitch in `PITCH.md`: four paragraphs, what, why, how and results,
each traced to its `docs/CLAIMS.md` rows.

- **Problem:** AI agents hold wallets and sign what their code hands them. The documented losses come
  from authority held by the model, lost state, and keys in the agent's process [M1–M7].
- **Solution:** a reference monitor for agent wallets. The agent proposes, Solanaut admits or denies by
  a named rule, the signer signs only receipt-bound bytes. A control loop stops retry loops [S3], and a
  Squads spending limit bounds a stolen key [M9].
- **Solana integration:** decodes legacy, v0 and v1 transactions from their bytes (System, SPL, Token-2022, fees),
  with an allowlist for every instruction; composes with Squads v4 spending limits, naming the agent's key on the
  limit; runs on devnet. State only what has passed its gate when the human submits (`docs/ROADMAP.md`).
- **Who it is for:** teams running trading or treasury agents; agent platforms; framework maintainers.
- **Business model:** `docs/papers/BUSINESS-PLAN.md`, the human's decision.
- **What is measured:** only what `docs/CLAIMS.md` §1 lists, each with its scope.
- **Open source:** the licence is the human's to choose, before the repository is made public.

## Changes

| Version | Date | What changed |
|---|---|---|
| Draft 1 | 2026-09-27 | First draft. The disclosure is corrected against the release record and `plugins/VENDORED.md`. |
| Draft 2 | 2026-09-30 | The Solana-integration answer follows `docs/SPEC.md` Draft 2, limited to what has passed its gate; the live link waits for milestone 2a.10. |
