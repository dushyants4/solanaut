# CI-2 — ordinary test-file scheduling

Hosted 6d81f8b run 37654130653 exposes a missed omission fault: default scheduling
can already be serial on a small runner. The fixture now supplies an explicit
leading parallel default, which the actual root command's leading serial option
must override. Omission is caught and restoration passes without dependence on
the machine's default parallelism. An attempted NODE_OPTIONS approach was rejected
by Node and is retained; the corrected fixture uses CLI options.
Exact hosted failure/metadata: `../sdk/checkpoint-bundle/hosted-6d81f8b/`.
Node 22 also still fails the real baseline wait; H11 proposes a separately
approved wait change, unapplied. This revision is not fully hosted-qualified.

2026-10-07 · builder-authored local Linux/Node 26.7.0 evidence.
The existing wait, workload and every readiness floor remain unchanged.

The previous CI command appended its scheduling option after test paths.
Node ignored that option. A direct two-file probe records both starts before
either end, while the leading-option probe records sequential execution.
The maintained regression uses the actual root command's leading options,
substitutes two timed fixture files, retains the previous suffix and asserts
their events never overlap. It fails first on concurrent file execution.

The root command now puts its serial option before the file arguments. Hosted
CI invokes that command without an ineffective appended option. Deliberate removal
of the leading option is caught by the scheduling regression; restoration passes.
The new campaign first fails maintained inventory before registration.

The full leading-option comparison passes 588 ordinary cases after two previous
ordinary attempts fail their staged-baseline wait. Focused recovery and a separate
committed supervised baseline also pass; these narrower passes alone were not
used to qualify the failed full runs. Hosted 2692542 has twelve successful jobs
and a Node 22 wait failure; its exact failure remains retained.

Regenerate:

- `node --test evals/ci/ordinary-serial.test.ts`
- `node evals/ci/ordinary-serial-faults.ts`
- `npm test`
- `npm run typecheck`
- `npm run test:coverage -- --serial`

Raw evidence: `ordinary-serial/` and `../sdk/checkpoint-bundle/`.
Final corrected ordinary integration passes all 589 cases and typecheck exits zero.
AST integration also passes all 589 cases and unchanged floors. Hosted
confirmation follows. This fixes
the demonstrated scheduling defect; it does not excuse any later timing failure.
