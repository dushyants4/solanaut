# 2026-10-27 — docs-front-door

Claude Code (Opus 5.5), in the public folder, 2026-10-27, at the human's direction.

## Asked

"Now work on refining the repo look i.e, the content on the repo page like the dev docs and repo landing page text and
ease of user understandability etc." The scope was Claude's to decide, as for the code reshape the session before
(`runs/2026-10-26-dhh-reshape.md`): polish the public snapshot in place, in this folder only.

## Did

1. Read the repository the way a visitor does: the landing page, the reading guide, the folder views on GitHub, and
   the developer guides. The README was sound but showed neither the product working nor a policy. The developer
   guides had grown one appended note per component: `docs/SDK.md` opened with fourteen paragraphs of status caveats
   before its first use, `docs/OVERVIEW.md` carried 230 lines of change notes above the overview itself, and
   `docs/PREVIEW.md` told a stranger to install a tarball from this machine's `/home/dashy/...` path.
2. Rewrote the front door, the way DHH's guides are written: show it working, then how to use it, then the reference,
   with each fact in one place. Every evidence link and claim reference was kept, or moved; none was dropped.
3. Checked each command and snippet by running it: the sandbox, the README's policy and its check, redeem, sign and
   report steps against the workspace SDK, the latch after five denials, the cockpit's offline demo, and PREVIEW's
   walkthrough end to end (build, pack, install in an empty project outside the repository, run the example: the
   expected JSON line).
4. An independent agent, given the pages and the code but not this record, read them as a newcomer would, ran their
   commands, and checked them against the code. Its findings, each verified against the code before it was acted on,
   are under Found; all were fixed.
5. Added `examples/guarded-payment.mjs`, so the guide's "from an empty file to a guarded payment" is a file that runs:
   a policy, a payment checked, redeemed, signed and reported, and one refused, offline.

## Changed

- `README.md` (version 6): the sandbox's real output first, with what its columns mean; the policy as plain data, with
  a comment on each field; the guard's calls; a reading table that separates code to write from code to read.
- `examples/guarded-payment.mjs` (new): the four calls, complete, with web3.js and no network.
- `packages/sdk/README.md`, `apps/README.md` (new): what GitHub shows when a visitor opens those folders. Every file
  or app in one line, with its command.
- `docs/SDK.md` (Draft 25): a guide (get it; check, redeem, sign, report; choose an integration; write a policy;
  refusals), then the reference, the errors, the internal components as one table, and the limits.
- `docs/OVERVIEW.md` (Draft 62): the overview first; the component notes gathered into §4 and §5 with their evidence;
  the tree and workflows brought up to date.
- `docs/PREVIEW.md` (Draft 2): built from any checkout, with no local paths.
- `docs/PACKAGING.md` (Draft 21): the commands first, the installed component checks as a table.
- `docs/STORAGE.md` (Draft 15), `docs/SIGNER.md` (Draft 11): headings, an opening paragraph, and two paragraphs that
  sat above STORAGE's own header moved under it; their text is otherwise unchanged.
- `docs/RPC.md` (Draft 3), and the stale notes in OVERVIEW: see Found.
- `docs/README.md` (1.1): a developer path that starts at the SDK guide.
- `packages/sdk/src/policy.ts`: the header comment said the policy is "never seen or changed by the model"; CLAIMS §4
  refuses "never sees". It now reads "written by the operator, and never changed by the model". A comment only.
- `kb/DOCUMENTS.md`: the rows and a dated note.

## Found

- **Stale notes in the guides.** OVERVIEW still called the batch-membership correction (D41) "prepared, not
  integrated" and the raw-buffer one (D40) blocked by a failing coverage run; RPC.md still called the redaction gap
  (D42) unresolved. All three were integrated by 2026-10-13 (S125, S157), and CI's coverage job passes (S163). SDK.md
  still said "hosted package-fault runner corrections remain owed"; CI now runs those 144 faults in four shards and
  passes.
- **The register lagged the files.** `kb/DOCUMENTS.md` listed OVERVIEW at Draft 38 and SDK at Draft 18 while the files
  said 61 and 24; it now matches.
- **A forbidden phrase in product code.** `policy.ts`'s header comment used the "never seen" wording CLAIMS §4 retired
  on 2026-10-13.
- **The independent read caught my own errors**, all fixed before the commit:
  - the README said the guard latches after five denials; it also latches at once when the loop brake refuses
    (ADR-012 C);
  - `guardedSigner` was said to wrap a signer "the same way" as `guardedWallet`; it neither sends nor reports, and
    records each signed message as `unknown` for the caller to settle;
  - the guide said a guard with `log: path` restores itself on restart; after a crash, the default manual ownership
    refuses the dead process's marker, so crash restarts need kernel ownership;
  - "pass the verified authorization" misdescribed `verifyPolicyAuthorization`, which returns the policy, and left out
    that `latch.releaseKey` must be the signing operator key;
  - `replay` was shown without `await`; block heights were not marked as bigints, which web3.js returns as numbers;
  - the README's snippet used a top-level `return`; `--issued` needs the `.000Z` form; the Agent Kit line needs two
    casts in TypeScript; the postures were never explained; the SDK guide carried a table of internals that belongs
    in OVERVIEW §5, where its details now are.
- **An intermittent signer test on Node 22.18.0.** CI run `40399232227` for `3d60645` failed one job: 986 of 987
  tests passed, and `DISC-1/CLT-1: sending client consumes the class-only denial from the running service`
  (`apps/signer/test/disclosure-followup.test.ts:105`) found no decision entry in the record, so the denial it got was
  probably one with no recorded decision (reference −1). The test and the signer are unchanged since 2026-10-13; the
  same job passed on Node 24 and 26.7 in that run and on all four earlier green runs; it passed 30 of 30 times here on
  Node 26.7.0 and 24.19.0; and the re-run of the failed job passed, making the run 19 of 19. The cause is not found.
- **ADR-012's status line** still says "Not built yet", though `evals/sdk/latch-c.md` records it built on 2026-10-05.
  ADRs are records kept as written; it is left for the architect.

## Open

- **README 6 and docs/README 1.1 await the human's review**; the register marks both `review`.
- **The GitHub "About" box** (description and topics) is already accurate. Its website field is empty; filling it,
  or adding a social preview image, is the human's call, since it changes the public page outside the repository.
- **Not restructured:** `docs/SPEC.md` (1,649 lines, the architect's), `docs/HANDOFF.md` (a working record), the
  papers, and `docs/CLIENT.md`, `docs/POLICY.md`, `docs/POLICIES.md` and `docs/REQUESTS.md`, which are already
  organized by task.
- **The intermittent `DISC-1/CLT-1` failure** is owed to the evaluator: find what makes the running service answer a
  refused proposal without a recorded decision, on Node 22.18.0 or under load. Its log is in run `40399232227`,
  attempt 1.
- Still owed from the session before: the one-line fix in `evals/release/integrated-fixes-faults.py`, for the evaluator.

## Provenance

- Node 26.7.0, npm 12.2.1 on this machine (the walkthrough's plain install and pack work with it); Linux, Toronto.
- Gates: `npm test` (987 of 987), `npm run typecheck`, `uv run --script tools/kb_lint.py` (every link resolves),
  `uv run --script tools/claims_lint.py`, `uv run --script tools/session_close.py` (10 of 10), and CI run
  `40399232227`: 18 of 19 on its first attempt, 19 of 19 after the failed job's re-run.
- The independent read ran `npm run sandbox`, `examples/offline-preview.mjs`, the cockpit demo, `replay`,
  `verify-archive` and `prepare-policy`, and type-checked the README's snippet against solana-agent-kit 2.0.10.
- The sandbox also runs on Node 24.19.0, which the README now names.
- Commands run to check the pages: `node examples/guarded-payment.mjs`, from the root and from another directory;
  `npm run sandbox`; the README's policy and calls in a scratch script against the workspace SDK, and the latch after
  five denials; `node apps/cockpit/src/demo.ts` and `npm run cockpit`; `npm run prepare-policy` with both timestamp
  forms; `npm run release:prepare`, `npm pack`, and PREVIEW's install and example in an empty project outside the
  repository.
