# SNP-3 — checkpoint binding authentication component

2026-10-06 · evaluator · builder-authored local Linux evidence, Node 26.7.0.
This component authenticates opaque checkpoint bindings under accepted ADR-019. It does
not restore admission state, replay the Keel prefix, publish a checkpoint or establish the
complete SNP-3–8 milestone. The SIG-11 ceiling and pending ADR-021 remain unchanged.
No signer wiring is added; host completion must recount its full implementation/helpers.

## Contract and limits

Descriptor format 1 binds a dedicated checkpoint public key, guard, localnet/devnet cluster,
sequence/head, policy version/hash, exact current evaluation profile and three SHA-256
digests: ordered archive catalogue, admission-state payload and telemetry/reset prefix.
Canonical snapshot and prefix text use separate signing domains. Both signatures must
verify against the externally pinned checkpoint key. That key must differ from every
principal key and the anchor key. Observed digests and external pins are captured before
caller metadata is evaluated; every observed digest must match its signed binding.
The sequence is the next record position; the head names its preceding entry. Genesis has
zero/empty head. Archive anchor pins identify an actual entry instead. The accepted checkpoint
cadence counts decisions, including denials, rather than every record transition.

The payload reader must independently compute these digests. This helper does not read
files, compute a catalogue from storage, validate state semantics or prove freshness.
Correctly signed stale or dishonest state remains possible under the signer-host trust
boundary. Full replay comparison, tail verification, atomic publication, invalid-checkpoint
fallback, bounded retention and operator recovery remain owed. No serialised Keel state is
loaded. Source candidate exports and the packed-consumer component now pass.

## First failures, faults and current evidence

All twelve initial cases fail against the stub (`checkpoint/initial-red.txt`). After the
implementation, adversarial JSON/caller-mutation and immutable-return cases are added.
The first fault campaign misses removal of the key pin: its fixture's wrong signature
already denies, masking the removed check (`checkpoint/faults.txt`). Add a correctly signed
descriptor that falsely names another authority. Preserve the miss; no production rule or
threshold is relaxed. A candidate-export case first fails (`checkpoint/export-red.txt`)
before the source entry is updated. The final seventeen cases pass (`checkpoint/restored.txt`).

Twenty-one real faults are caught (`checkpoint/faults-final.txt`): format, profile, sequence,
policy version, head, principal/anchor separation, guard/network/key pins, each observed
digest, mutable caller pins/digests, each signature, domain separation, canonical base64, immutable output and candidate
export. Source
restores and passes. Ephemeral fixture signing keys exist in process memory only; no key
file, funded principal or network transaction is used.

The maintained campaign inventory first rejects the unregistered new file
(`checkpoint/inventory-red.txt`). The critical coverage test first accepts an isolated
checkpoint deficit incorrectly (`checkpoint/coverage-red.txt`); add this file to the
existing critical inventory without changing its floor. Eight inventory/coverage cases
then pass (`checkpoint/inventory-coverage-final.txt`). Actual serial instrumented coverage
passes all 499 cases and existing floors (`checkpoint/coverage-measurement.txt`,
`checkpoint/coverage-summary.json`); checkpoint statements 56/56 and branches 70/70.
The expanded full campaign is running in an isolated copy; root mutation inputs stay unchanged.

Typecheck first rejects an intentionally malformed signature fixture's excess property
(`checkpoint/typecheck-red.txt`); its explicit malformed-input cast preserves the runtime
case. Corrected typecheck is recorded in `checkpoint/typecheck.txt`. Ordinary root tests
pass all 496 cases with serial, lower-priority execution (`checkpoint/root-tests.txt`).
The release-only build and nine actual outside-workspace installed checks pass
(`checkpoint/build.txt`, `checkpoint/package.txt`). JavaScript verifies both signature
domains, rejects altered observed state and returns typed refusal; declarations reject
unsupported clusters and missing signatures. Five compiled-candidate faults are caught,
including removal of the checkpoint export; restored artefacts pass (`checkpoint/package-faults.txt`).
Aggregate faults, close and private sync are still pending. These
component tests are not independent RT-2 or audit evidence.

## Bounded-key follow-up, 2026-10-07

Review finds the local public-key validator decodes arbitrarily long input. The predeclared
excessive-key child case first reaches containment (`checkpoint/key-bound-red.txt`). Reuse
the existing bounded canonical-address validator, without changing base58 source or accepted
key semantics. Eighteen cases pass (`checkpoint/key-bound-final.txt`). Twenty-two real faults
pass with restoration (`checkpoint/key-decoder-faults-final.txt`), including reinstatement
of the original unbounded decoder. The earlier synthetic quadratic-work fault is retained
(`checkpoint/key-bound-faults.txt`) but is not the final real decoder fault.

Full ordinary source checks pass 500 cases (`checkpoint/root-tests-key-bound.txt`), then
the independently scoped CI diagnostic addition brings the integrated candidate to 504
(`../ci/caps/first-failure-root.txt`). The 500-case instrumented measurement passes every
existing floor (`checkpoint/coverage-key-bound.txt`, `coverage-key-bound-summary.json`).
Checkpoint statements 54/54 and branches 69/69. No floor is reduced; reuse removes duplicate
decoding work. Final current-population measurement passes all 504 instrumented cases and
every existing floor (`checkpoint/coverage-final-current.txt`, `coverage-final-summary.json`).
SDK statements 1,963/2,056; branches 1,612/1,743. Signer statements 466/487; branches
334/354. Exact source hashes and serial arguments are retained; prior reports remain intact.

Regenerated release artefacts pass all nine installed checks and five compiled faults
(`checkpoint/build-key-bound.txt`, `package-key-bound.txt`, `package-faults-key-bound.txt`).
The earlier full isolated aggregate fails its restored property check; the second passes
all thirty-five campaigns/310 faults with exact restoration, but both use the pre-bound-fix
manifest (`checkpoint/fault-candidate-manifest.json`). They do not qualify later code.
The final current isolated aggregate exits zero and passes all thirty-five campaigns,
with 315 caught-fault lines (`checkpoint/isolated-bite-final-current.txt`). All 715 copied
inputs and all 65 compiled files restore exactly, including complete release inventory
(`checkpoint/fault-candidate-final-manifest.json`, `checkpoint/final-restoration.json`).
Hosted candidate CI and private close follow. The new child containment test
establishes this refusal case, not general latency, bounded metadata memory or state restore.

## Regenerate

- `node --test packages/sdk/test/checkpoint.test.ts`: eighteen cases.
- `node evals/sdk/checkpoint-faults.ts`: twenty-two faults and source restoration.
- `node --test evals/ci/bite.test.ts evals/ci/coverage.test.ts`: eight gate cases.
- `npm run typecheck`.
- `env -u SOLANAUT_PROPERTY_TRIAL nice -n 19 npm test -- --test-concurrency=1`: all 504 current-source cases.
- `npm run release:prepare`; `npm run test:package`; `npm run test:package:faults`:
  nine installed checks and five compiled-candidate faults, without loader flags.
- `nice -n 19 npm run test:coverage -- --serial`: full population and unchanged floors.
- `npm run test:bite` in an isolated candidate with local workspace links; verify restored
  bytes before claiming its aggregate result. Never mutate the live Stryker input sources.
