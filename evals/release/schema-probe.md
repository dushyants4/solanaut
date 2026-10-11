# SDK inventory schema attempt — refused

2026-10-11 Toronto · builder-authored diagnostic · reviewed 25b4c45 · CLAIMS
S137. No tool installed and no maintained gate changed.

The existing Ajv and ajv-formats graph is available, while Python jsonschema is
absent from this interpreter. A strict attempt uses the official
[CycloneDX schema source](https://github.com/CycloneDX/specification/blob/1.5/schema/bom-1.5.schema.json)
and its SPDX/JSF references, with exact SHA-256 pins in `schema-probe.mjs`.
Files are scratch inputs, not vendored source or approved new dependencies.

Initial exploratory compilation with permissive schema settings warns that
`iri-reference` and `idn-email` are ignored. That compilation is not validation
evidence and no result from it is accepted. The archived strict attempt instead
throws on missing `iri-reference`, before validating the derived inventory.
The first raw attempt and a separately status-captured reproduction remain;
the latter exits one, with report validation false in `result.json`.

Regenerate after obtaining the pinned schema inputs in `.sandbox/cyclonedx-schema`:

```sh
node evals/release/schema-probe.mjs
```

Fetch each schema only from the same official repository/tag path; the script
refuses changed bytes. A supported validator/formats toolchain must be selected,
pinned and approved before full schema qualification. Do not replace missing
formats with always-true callbacks or treat warnings as a pass. Any correction
requires invalid-schema/report controls and fresh actual artifact validation.

This is a failed diagnostic, not a schema finding in the artifact, complete
format check, release gate, vulnerability/licence clearance or stable milestone.
The prior S136 draft and all its limitations remain intact.
