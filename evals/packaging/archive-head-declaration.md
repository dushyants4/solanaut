# Archive head error-code declaration regression

2026-10-11 Toronto · builder-authored installed diagnostic. CLAIMS S154.
PKG-2 / CI-2. No product or maintained gate changes.

Historical consumer edit 00c42e8 replaces the typed `ArchiveErrorCode` example
`head` with `anchor`. This checks the added anchor contract but no longer protects
head in the declarations. Runtime head-pin refusal remains tested; the current
product type is intact. This is a declaration-check gap, not a product defect.

Use the actual D40 archive bound by S130, not unintegrated D41 staging.
SHA-256: `55e8753409bb04960271418e1a3d907b8f3130ff16c10a0a143080be50af489d`.
Change only `dist/src/archive.d.ts` in isolated extracted copies; every other
package file matches in `package-files.json`. Original archive/test bytes remain.
Consumers install offline outside the repository without scripts.

| Complete package control | Result |
|---|---|
| Maintained test / actual archive | 19 pass |
| Maintained test / head member removed | 19 pass: missed fault |
| Maintained test / anchor member removed | 18 pass, one typed failure; TS2322 names anchor |
| Proposed copy / head member removed | 18 pass, one typed failure; TS2322 names head |
| Proposed copy / actual archive | 19 pass |

Every population executes all nineteen cases on Node 26.7.0, with no skip,
cancellation or todo. The proposed copy relocates fixture imports/root only
and adds a typed head example beside anchor, retaining cases/assertions/deadlines.
The hash-bound reproducer confirms all five results with complete separate raw
outputs. This does not establish exhaustive type-union/mutation coverage, native
qualification or independent security.

```sh
uv run --script evals/packaging/archive-head-declaration-run.py
git apply --check evals/packaging/archive-head-declaration/owner.patch
```

The reproducer checks frozen source/archive/proposed hashes, refuses existing
owned scratch and preserves original evidence. Preserve its scratch directory
before regeneration. Earlier preparation/raw observations remain separately.
The exact `owner.patch` passes read-only validation; HANDOFF O10 is unapplied.
No protected gate, threshold, ADR or formal milestone changes.

Remaining consumer inspection covers replacement blocks only, not every complete
patch/new case. No consumer-history clearance follows. H11, O10, broader and
independent/public-history review and stable qualification remain open.
