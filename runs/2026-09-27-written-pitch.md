# 2026-09-27 · written-pitch

## Asked

"Give me whole Solanaut pitch in 4 paragraph. what why(problem) how(solution) results." Then, when
offered a place for it: "sure add wherever makes sense".

## Did

1. Wrote the pitch in four paragraphs. Every fact was traced to a `docs/CLAIMS.md` row and kept within
   that row's scope. It was delivered in chat.
2. Filed it into `docs/submission/PITCH.md` as the written version, between the thirty-second version
   and the video script. That made it Draft 2.
3. Pointed the long-form project-detail answers in `docs/submission/SUBMISSION.md` at it.
4. Registered Draft 2 in `kb/DOCUMENTS.md`, and logged the file-back in `kb/LOG.md`.

## Changed

| File | Why |
|---|---|
| `docs/submission/PITCH.md` | the written pitch; the script's 1:40 line scoped to bots; two rules added; Draft 2 |
| `docs/submission/SUBMISSION.md` | a pointer to the written pitch for long-form fields |
| `kb/DOCUMENTS.md`, `kb/LOG.md` | the register and the log, per `workflows/knowledge.md` |

## Found

- **A scope slip in the Draft 1 script.** The line at 1:40 read "Agents also loop: bots on Solana fail
  more than half their transactions". M8 is about bots, not AI agents, so it now reads "Automated
  senders also fail constantly".
- **Choices kept to stay inside the claims:**
  - The drain scenario's amounts are left out: they are scenario inputs, not a `docs/CLAIMS.md` row.
  - No test count is stated.
  - The Squads limit, receipts, intents and wrappers are described as "being built".

## Open

- **Delivery is the human's (T4):** the Colosseum fields, the README when public, any post.
- **Keep it current.** Each milestone review updates the *How* and *Results* paragraphs, a rule now in
  `PITCH.md`.

## Provenance

- Every claim ID cited in `PITCH.md`'s trace lines resolves to a row in `docs/CLAIMS.md` as of `65d54b8`.
- Regenerate the checks with `uv run --script tools/session_close.py --slug written-pitch`.
