# DEP-1 — scoped evaluation dependency remediation

2026-10-07 · builder-authored Linux, Node 26.7.0, npm 11.19.0;
base `f8d22f9` plus this candidate. Evaluation-tool dependency only.

The original Stryker/typed-rest-client route resolves qs 6.15.1. Three regressions
fail first: exact resolution, hostile constructor serialization and nullable comma
arrays. The [reviewed constructor advisory](https://github.com/advisories/GHSA-4mjr-xmp4-gh2g)
identifies 6.16.0 as patched. The candidate scopes an exact qs 6.16.0 override to
typed-rest-client 2.3.1. Stryker and the client remain pinned unchanged.

Initial npm install/update leave the invalid nested copy; their failures are retained.
Deduplication also changes unrelated dependencies and is not accepted. Restore the
original lock graph except the obsolete nested qs entry, then clean-install the lockfile
with `npm ci --ignore-scripts`. Three cases pass against the real installed client.
Four planted faults revert the scoped pin, installed metadata and both crash guards;
all are caught, and installed source bytes restore exactly. No upstream patch or fork
ships. The override is Solanaut's tested compatibility choice, not upstream endorsement.

The fresh audit retains nineteen affected package findings, including seven high;
it exits one and is not release clearance. The qs/typed-rest-client audit entries are
absent. Registry signatures verify for the installed graph. Lifecycle scripts are
disabled for this installation; script-enabled clean deployment remains a separate gate.
Full mutation qualification must use this new lock digest and remains owed.

Final local integration passes 545 cases, nine packed-consumer checks and typecheck.
The pre-sync close refuses the uncommitted tree. Hosted recovery revision f8d22f9
has a Node 22 failure under investigation; it is not represented as a hosted pass.

Regenerate: `node --test evals/ci/dependency.test.ts`,
`node evals/ci/dependency-faults.ts`, `npm ls qs typed-rest-client --all`,
`npm audit --json`, `npm audit signatures`, `npm test`, `npm run typecheck` and
`npm run test:package`. Raw failures, registry metadata and current audits live in
`dependency/`. Independent review and all remaining release requirements remain owed.
