# Private queued redemption — ADR-019 lifecycle foundation

2026-10-09 Toronto · Linux/Node 26.7.0 · base `fe6369f` plus candidate.
Builder-authored component evidence; not independent review or stable release.
Requirements LIF-2, SNP-7, OPR-2 and STO-1; existing trusted SDK unchanged.

## Contract and evidence

The private facade queues redemption with admissions, control work, observations
and shutdown. Capture message bytes into private ordinary backing before queueing.
Delegate the SDK's admitted-byte, lifetime, policy and single-use checks, including
its synced redemption entry. Return detached frozen success only; any refusal
throws fixed `OwnedGuardError`. Failed writes retain the failed writer and pending
reservation. Refused/used/expired receipts never produce a successful response.
No key, signature, send, release, report or new socket/root export is introduced.
Full retained state remains; no bounded recovery or signer-budget claim follows.

Source tests first fail on the missing method and exact surface. The installed
fixture first has an escaped-newline syntax error; preserve that setup failure,
correct the fixture and observe missing redemption in the previous actual package.
The new source cases cover held preceding control work, caller mutation of shared
bytes, observation ordering, immutable replies, duplicate use after restart,
wrong bytes/foreign receipt/absent or expired height, post-close refusal and actual
descriptor write failure with fixed diagnostic redaction. Boundary refusals leave
sequence unchanged and allow a subsequent valid redemption at the admitted height.

An initial build overlaps source fault injection and is not used as evidence.
Rebuild after exact restoration. Definition 36/seed 36191 retains every earlier
selected input, wait, floor and limit, adding the redemption cases. All previous
source and compiled fault trials remain; candidate full qualification follows.

The first archival pack uses a directory created relative to staging rather than
the intended root path and fails ENOENT. Preserve its error JSON; create the root
component directory, remove only the mistaken empty staging directories and pack
there successfully. Earlier component archives remain untouched. The restored
source/input/emitted-file/archive identities are bound in `installed-candidate.json`.

```bash
node --test --test-isolation=none packages/sdk/test/owned-guard.test.ts
node evals/sdk/owned-guard-faults.ts
npm run release:prepare
node --test evals/packaging/packed-sdk.test.ts
node evals/packaging/faults.ts
npm test
npm run typecheck
npm run test:coverage -- --serial
uv run --script tools/session_close.py --slug codex-solanaut-1
```

## Qualification status

Raw outputs are retained in `evals/sdk/owned-redemption/`, registered by CLAIMS
S97. Thirteen focused cases and twenty-four source faults pass/restored; twelve
installed cases and all 122 compiled faults pass/restored, retaining all earlier
trials. Serial AST passes all 838 cases and unchanged floors; owned-guard coverage
is 92/95 statements and 36/38 branches. All raw AST reports are preserved, with
matching restored source/input/emitted-file/archive digests. Typecheck exits zero.

The initial quiet ordinary run executes 838 cases: 837 pass and the unchanged
real-baseline wait fails. Preserve it at equal weight to passing AST evidence.
One native diagnostic repeat follows to assess timing repeatability, without
changing definition, seed, population, wait or product/readiness targets.
That repeat passes all 838 cases. Preserve both outcomes; timing instability
remains open and a passing repeat is not reliable hosted qualification.
No mutation score or fresh isolated-driver qualification is claimed.
H9/H11 approval is not inferred from “Work”. Human, Claude, audit and publication
gates remain.
Local Git commits/backups only; no remote push or stable milestone credit.

## Maintained driver follow-up and local archive

`node evals/ci/mutation-recovery-faults.ts` completes its nine recovery fault
trials with initial/restored baselines passing. Six driver refusals are observed,
but the final restored baseline fails the unchanged wait. Preserve the entire
failed output; do not award complete driver-campaign credit. Every bound product,
evaluation, emitted-file and archive digest matches after restoration.
This independently repeats the timing finding within builder-authored checks;
it is not an independent security review. H11 remains open.

Implementation is committed locally as `4d9d1fe`. Its local Git bundle verifies;
cloning it restores exactly that clean revision and full object-integrity checks
pass. This is source-history backup on the same machine, not operator-state or
off-device recovery. Pre-commit close passes the local checks but fails dirty tree
and unpushed HEAD. Raw output whitespace is preserved; the authored TypeScript
and Markdown diff check passes. No push, threshold change or stable release follows.
