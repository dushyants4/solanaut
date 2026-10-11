# Current private SDK — consumer inventory preparation

2026-10-11 Toronto, reviewed 6b1f78d, Node 26.7.0/npm 11.19.0, same Linux host.
Builder-authored release preparation; no R.1 freeze or qualification is implied.

Install the exact current D40 tarball offline with scripts disabled into a
temporary consumer outside the repository. Before the healthy control, remove
its installed Gubernaut runtime dependency into a saved directory. npm's actual
CycloneDX generator refuses with exit one and ESBOMPROBLEMS. Restore the exact
directory, then generate the healthy inventory and retain the full installed
graph from npm. The temporary consumer is removed afterwards.

The generated CycloneDX 1.5 consumer report has two package components:
`@solanaut/sdk` 0.0.0 and `@gubernaut/core` 1.0.1. Its three dependency nodes
describe consumer → SDK → Gubernaut, with no further runtime dependency.
The SDK component's SHA-512 matches the exact tarball bytes; the original
SHA-256 is also checked before and after. Runner/revision/runtime identity,
raw missing-dependency failure, graph, report and resulting digest are retained.

```sh
uv run --script evals/release/sdk-inventory.py
```

The report includes the synthetic consumer root, including npm's root name
derived from its temporary directory. It is **not a package-centred release SBOM**.
No metadata is rewritten to conceal that scope; preserve original output before
regeneration. Timestamp and UUID vary between runs, so byte reproducibility is
not claimed. The inventory's dependency edge/version/artifact hash checks do
not establish full schema validation, vulnerability freedom or provenance.

The SDK component has no licence field. The report's upstream licence field is
package metadata, not a source-rights assessment or human licence decision.
No licence, visibility or publication changes occur. It is private inventory
preparation only; every package still needs its frozen release SBOM and the
complete rights, confidentiality, history, audit and R.1–R.5 programme.
