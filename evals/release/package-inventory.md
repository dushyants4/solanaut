# Current SDK package inventory — derived draft

2026-10-11 Toronto · builder-authored release preparation · reviewed fa2f6e2 ·
Linux, Node 26.7.0, npm 11.19.0. CLAIMS S136. No product or maintained gate changes.

## Finding and first failures

Extracting the actual D40 tarball and running offline/scripts-disabled
package-lock-only resolution, followed by npm CycloneDX generation, succeeds.
The untouched report names the root `package`, although its root reference and
package URL identify `@solanaut/sdk@0.0.0`. Its root also lacks archive hashes.
`npm.stdout` preserves that report, and `raw-root-refusal.txt` preserves refusal
under this draft artifact contract. The earlier consumer inventory S133 remains
unchanged. No npm implementation is modified.

Six INV-1/2/3 controls fail against the initial identity projection and absent
validator, retained in `initial-red.txt`. They cover root identity, raw preservation,
artifact hashes, dependency edges, runtime version and unexpected components.
The root negative is subsequently tightened to carry valid hashes, so a missing
identity check cannot be masked by a different refusal. Final controls all pass.

## Derived artifact

The projection copies the raw report, sets root group/name from the actual
tarball manifest and adds SHA-256/SHA-512 from actual tarball bytes. It preserves
runtime metadata, package URL/reference and dependency edges. The validator
requires the explicit current SDK manifest, exact root identity, exact archive
hashes, sole pinned runtime component and complete SDK-to-Keel graph. It refuses
different package versions; no future release version is silently inferred.

`derived-package.cdx.json` is an explicitly authored draft, not npm's original
output. `binding.json` binds both outputs to the same tarball. The runtime
component's SHA-512 matches the freshly generated lock's integrity. That lock
describes offline resolution; no runtime installation or code execution is
claimed here. Prior actual installed graph evidence is separately in S133.

Current SDK archive SHA-256:
`55e8753409bb04960271418e1a3d907b8f3130ff16c10a0a143080be50af489d`.
The original archive and runner bytes stay unchanged, and the temporary tree is
removed. Definition, actual manifest, lock and raw stdout/stderr are retained.

## Faults and regeneration

Four isolated copied-source faults omit root validation, archive validation,
edge validation or private copying. Each completes the full six-case population
and fails; raw diagnostics and `faults.json` retain the results. Original module
and test bytes remain identical, and controls pass afterwards. No miss occurs
in this campaign. This is not an independent review or full mutation score.

```sh
python evals/release/package-inventory.test.py
python evals/release/package-inventory-faults.py
uv run --script evals/release/package-inventory.py
npm run typecheck
```

Preserve the existing evidence directory before a fresh generation: the runner
refuses an existing definition. Generator UUID/time metadata changes across runs;
the sidecars bind this exact output, not reproducible SBOM bytes. Fault/control
commands intentionally replace only their respective copied-trial evidence.

## Limits

No complete CycloneDX schema validation, independent generator comparison,
vulnerability or licence clearance, provenance, security freeze or other-package
inventory follows. SDK licence remains absent. This is not an approved R.1 SBOM,
public artifact, package/version change, gate exception or stable milestone.
