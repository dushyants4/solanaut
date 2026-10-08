# Original history inventory — owned-publication revision

2026-10-08; local Linux/Node 26.7.0; read-only PUB-1 review preparation using the
maintained inspector. This is not source-rights, confidentiality, secret review
or publication clearance. No visibility, historical object or human drop changed.

Refresh the existing project-local private origin mirror with
`git --git-dir=.sandbox/solanaut-1/history-origin.git fetch --prune origin`, then:

```sh
node evals/ci/history-run.ts --repository .sandbox/solanaut-1/history-origin.git
```

The resulting mirror HEAD is `5a33e698703446708729a8271a7a4c38a3a7dce7`.
The inventory covers five advertised refs, their 114-commit parent closure,
3,085 historical blobs and 2,026 distinct paths; no gitlinks are observed.
Digest: `9207920222770feae2b7f8ffc83be0be326839d2dd8ad33e479ed8bf3e1d34a7`.
Exact ref/object/path identities and summary are retained in
`history/inventory-5a33e69-920792022277-1791492345196.json` and
`history/owned-publication-summary.json`. The inspector reads each actual commit
body and verifies its object hash; its earlier cached-graph defect and corrected
fault evidence remain in `history-commit-read.md`. Inspector source is unchanged.

Reflogs, unreachable objects, uncommitted changes and gitlink repositories are
explicitly excluded. Later archival commits are outside this captured revision.
Human selection of the eventual public ref set and hosted-history exposure is
still required. Freeze and regenerate against the final publication candidate;
this manifest cannot clear a later revision. Blob metadata is no substitute for
full content/rights/secret review, and no release milestone closes.
