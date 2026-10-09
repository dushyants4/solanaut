# Existing Node runtime qualification

Builder-authored local qualification, 2026-10-09 Toronto, Linux x86-64,
revision `fba638ad2d55b359771a6cf4ac517a3b1c6521ad`. Native development stays
pinned to Node 26.7.0. Read-only mise inventory identifies Node 24.19.0 already
installed; no download, tool installation, global configuration or active
Solana release change is performed.

Run the unchanged complete native population and maintained installed consumer
against the same restored private JavaScript candidate. Definition 38/seed 38653,
every selected source/test, floor, wait and process limit remain unchanged.
Record failures without replacing the existing wait or taking coverage/matrix
credit from native results. The installed package remains private `0.0.0`.

```bash
mise ls --installed node
mise exec node@24.19.0 -- node --version
mise exec node@24.19.0 -- npm test
mise exec node@24.19.0 -- node --test evals/packaging/packed-sdk.test.ts
mise exec node@24.19.0 -- npm run typecheck
mise exec node@24.19.0 -- npm run test:coverage -- --serial
mise exec node@24.19.0 -- node evals/packaging/faults.ts
```

Candidate identities are those in `evals/sdk/live-record/installed-candidate.json`;
retain exact checks after qualification. Raw output lives in `node24-current/`.
This is the current Linux host, not a clean Ubuntu installation, independent
security campaign, complete supported-runtime matrix or stable release gate.
Native and serial AST each pass all 847 cases; all thirteen installed consumer
cases pass and typecheck exits zero. Unchanged AST floors pass: the record covers
298/307 statements and 170/179 branches, and the private facade covers 109/112
statements and 46/48 branches. The unchanged real staged baseline completes
locally before its existing wait. This single pass does not establish timing
reliability or clear H11. Exact bound candidate identities still match; raw
reports and scoped identity verification are archived. CLAIMS S100 records the
measurements. No new implementation or workload definition is introduced.
Earlier Node 26 AST wait failure remains an open finding.

Maintained Node 24 compiled qualification also catches all 130 retained faults;
the final restored installed consumer baseline passes. Exact product, evaluation,
emitted-file and separate archive identities match again after restoration.
The corrected local Git bundle restores exact clean `12e3895` and fsck passes;
post-commit close fails only pushed HEAD, retained under the no-push direction.

Archival close initially rejects S100's mise-prefixed command grammar; its parser
requires an underlying npm/node/uv command. The first archival commit is made
before that output is inspected. Preserve the workflow finding and add the actual
underlying commands under the explicitly scoped Node environment, without changing
the protected linter, measured inputs or results. Re-run close before correction.
