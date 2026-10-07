# CI-2 — bound completion-record checks

2026-10-07 · builder-authored local Linux evidence, Node 26.7.0.
This is a record checker foundation for durable run supervision. It is not the detached
supervisor, actual child waiting, atomic publication or mutation qualification. Fixture
records do not prove that a process ran. A trusted producer and protected result storage
remain required; a compromised host can invent a well-formed successful record.

The checker captures external run/input/command pins before caller evidence. It requires
the exact versioned completed shape, canonical ordered timestamps, distinct positive
process identities, exit zero and no signal, launch error or timeout. Unknown fields,
missing fields and caller mutation refuse. Error text does not echo accessor exceptions.
The fault aggregator now fingerprints operator TypeScript as well as existing sources.
An outside working-directory rehearsal exposes a missing scratch parent in its fixture
(`cold-fixture-red.txt`). The fixture creates its own parent; the clean-directory run then
passes (`cold-fixture-final.txt`). This setup correction does not change fingerprint semantics.

The initial stub refuses valid results (`run-completion/initial-red.txt`). The original
fingerprint ignores operator tools (`fingerprint-red.txt`). Campaign inventory rejects
the unregistered new campaign (`inventory-red.txt`). First faults miss removal of the
input-field check because the post-capture field check masks it (`faults-first.txt`).
Separate JSON projection fixtures expose both checks. Malformed external pins now also
match the supplied body, isolating their validation from an identity mismatch.

Eight record cases plus one real fingerprint case pass. Sixteen real faults are caught
and source restores (`faults-final.txt`); all twelve record/fingerprint/inventory cases
pass (`focused-final.txt`). No original SDK mutation source or dependency is changed.
Full ordinary integration passes all 513 cases with the trial-mode variable unset
(`root.txt`); typecheck passes (`typecheck.txt`). The frozen isolated aggregate exits zero
across thirty-six campaigns with 331 caught-fault lines. All 773 inputs and all 65 compiled
files restore exactly, including complete release inventory (`candidate-manifest.json`,
`isolated-bite.txt`, `restoration.json`). That manifest precedes only the separately checked
scratch-parent fixture correction. Its updated fixture manifest and sixteen focused faults
pass with exact restoration (`candidate-fixture-manifest.json`, `fixture-restoration.json`,
`faults-fixture-candidate.txt`). The final source recheck passes all 513 cases and typecheck
(`root-final.txt`, `typecheck-final.txt`). No production code changes. Private close follows.

Regenerate with `node --test evals/ci/run-completion.test.ts evals/ci/bite-source.test.ts
evals/ci/bite.test.ts`, `node evals/ci/run-completion-faults.ts`, `npm run typecheck` and
`env -u SOLANAUT_PROPERTY_TRIAL nice -n 19 npm test -- --test-concurrency=1`.
Full fault aggregation uses a separately bound candidate while the original mutation
run remains active; verify exact source and compiled artefact restoration afterwards.
