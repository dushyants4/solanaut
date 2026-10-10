# Current maintained fault runner qualification

Builder-authored local evidence, 2026-10-09–10 Toronto, Linux/Node 26.7.0.
Exact implementation `227b0bb95476feccebaa9516ca88c86a90050acb`.
The existing maintained campaign inventory, partitioning, source fingerprint
and process limits are unchanged. Run actual partitions, not a substitute list
of direct successes. Raw output and source identity are preserved.

Actual partition two attempts all 22 selected campaigns, fails only
`packaging/faults.ts`, and skips none. Its package completion marker is absent.
Source fingerprint and bound product/evaluation hashes match afterwards; the
ignored emitted request-index module differs after interruption. Preserve that
finding, rebuild the candidate from reviewed source and verify identities.

The runner does not emit the child termination detail. Reproduce its exact
package invocation with the unchanged limit in `bite-current/observe-package.mjs`;
the observer records status, signal and error without changing campaign options.
The uncached diagnostic records `ETIMEDOUT`, null status and `SIGTERM` at the
unchanged limit. Rebuild the interrupted candidate before further use. A direct
campaign pass does not qualify its runner, and restoration never converts an
interruption into a pass.

Investigate execution-only compilation caching with Node's existing environment
controls; sources, cases, assertions and process limits stay unchanged. Confine
the requested cache to repository scratch and fault execution. Coverage remains
uncached. Source: [Node 26.7.0 module cache documentation](https://nodejs.org/download/release/v26.7.0/docs/api/module.html#module-compile-cache).
The guard refuses the mixed setup/status probe; preserve the refusal and do not
retry the probe. The separate cache-configured fault invocation also records
ETIMEDOUT, null status and SIGTERM at the unchanged limit. It does not resolve
the runner failure. Preserve both outputs/termination receipts; rebuild emitted
files again and verify bound product/evaluation/emitted/archive identities.
No cache-status or performance improvement is claimed. Other maintained
partitions are independent checks and do not waive the failed campaign.
All 65 campaigns are attempted through the unchanged partitions, with none
skipped. Partition three passes. Partition one fails only mutation recovery:
its initial unmodified baseline fails the unchanged real staged wait before the
campaign's planted faults run. This is the existing H11 failure, not caught
mutation evidence. Partition two fails only the package campaign as above.
Complete maintained-fault qualification fails.

Final source fingerprint, bound product/evaluation/emitted/archive identities
and restored typecheck match/pass. Preserve successful campaigns and both
failed partitions with the same weight. No timeout change, test filtering,
source gate edit, cache adoption or complete CI pass follows.

```bash
npm run test:bite -- --partition 2
node evals/ci/bite-current/observe-package.mjs
npm run test:bite -- --partition 3
npm run test:bite -- --partition 1
```

Previous current-host native/type/installed/compiled results and the unchanged
quiet AST failure remain in `evals/release/node24-owned-report.md`. No independent
security, complete CI, bounded-state or stable qualification follows. All work
remains local; no remote push or protected gate edit is authorised.
