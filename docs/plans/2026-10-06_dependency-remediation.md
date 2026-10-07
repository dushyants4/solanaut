# Dependency findings — remediation before release freeze

2026-10-06 · operator preparation under Solanaut 1.0.
These findings remain open. This is triage of the retained mutation-preparation audit,
not a new audit, exploitability clearance, dependency update or R.1 exit.

## Recorded input and boundaries

`evals/ci/mutation/audit.json` records the advisory response for the preparation lockfile;
`evals/ci/mutation/signatures.txt` records authenticity checks. Signature authenticity does
not resolve advisories. The lockfile remains unchanged during the frozen mutation run.
Regenerate advisory/signature evidence after that run and after every dependency change.

The SDK runtime manifest declares only the pinned published Keel dependency. The workspace
also contains framework, cockpit, on-chain and evaluation-tool dependencies. A clean SDK
package manifest cannot clear those other deployment paths. Qualify each release artefact's
actual dependency graph and executed imports, including installation scripts and services.

## Priority work

| Finding / installed route | Required remediation and evidence / owner |
|---|---|
| `bigint-buffer` through token layouts in Agent Kit and Squads consumers | Operator/builder: replace the affected release dependency path using compatible published packages or the accepted kit-based implementation. The [reviewed advisory](https://github.com/advisories/GHSA-3gc7-fjrx-p6mg) lists no patched version. Do not substitute an unreviewed fork, quietly patch upstream, or infer safety from a JavaScript fallback. Evaluator: malformed-account/native-path regressions and full integration evidence for the resulting graph. |
| `jsondiffpatch` through Agent Kit's AI dependency | Operator/integrator: evaluate a compatible published framework/dependency update; preserve signing semantics and accepted integration scope. The [reviewed advisory](https://github.com/advisories/GHSA-j4fx-xxwh-2485) identifies prototype pollution in patch APIs. Evaluator: prove the installed graph is remediated and re-run the framework's adversarial transaction/signing battery. |
| `langsmith` through Agent Kit's LangChain dependency | Operator/integrator: evaluate compatible published updates for every retained advisory, including [untrusted public-prompt deserialisation](https://github.com/advisories/GHSA-3644-q5cj-c5c7). Disabling telemetry alone does not establish remediation for all affected APIs. Evaluator: integration, redaction and untrusted-prompt tests where those paths remain in scope. |
| `typed-rest-client` / nested `qs` through Stryker | Operator: evaluate a compatible published evaluation-tool update or exact supported transitive resolution, after the active run. Evaluator: signatures, clean installation, report/fault gates and a fresh frozen full mutation run if the runner definition changes. Tool-only scope does not erase a supply-chain finding. |
| Other retained low/moderate routes | Operator: enumerate the complete current graph and advisory identities, apply supported updates and retain unresolved findings. Evaluator: exercise affected paths and compare the new graph with the package SBOMs. Medium acceptance remains subject to the existing policy; Codex does not approve its own exception. |

The audit's automatic suggestions include earlier major framework versions. Do not run
`npm audit fix --force` or treat a downgrade as compatible because the report calls it a fix.
Every deliberate version change requires its pin, registry record, signature verification,
packed-consumer checks and affected integration/replay tests. Gubernaut remains consumed only
as the exact published pinned package; a finding there goes to the human rather than a workaround.

## Exit evidence

Keep the old audit and all failed update attempts beside fresh results. Record candidate
revision, lockfile digest, package versions and actual deployment graph. Produce package
SBOMs only from the corrected frozen candidate. A claimed unreachable path needs a reviewed
reachability argument and regression evidence; absence from a quick source search is not proof.
No critical/high finding is marked resolved without remediation and verification. The
specialist audit, independent campaign and human-owned release decision remain required.
