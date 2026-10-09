# Owned control FIFO — local component qualification

2026-10-09 Toronto · Linux/Node 26.7.0 · base `789bc7b` plus candidate.
Builder-authored evidence, not independent security review. Accepted ADR-019;
SPEC LIF-4/5, SNP-7 and OWN-2. The human now requires local Git commits only.

## Frozen contract

Internal `beginOwnedRequest`, `finishOwnedRequest` and `ownedRequestResult` share
the proposal companion's FIFO on a genuine signed guard. Each consults the
actual kernel-owned request index through the current head. After that await,
closure/head comparison and bookkeeping/reply capture are synchronous. A copied,
unsigned, manual or memory store cannot establish owned disk evidence.

Capture identities and canonical payload/result text before queueing. Preserve
the existing control methods, namespace, codec bounds and record semantics.
Matching starts and immutable responses retry exactly; a changed method/payload,
foreign start or response refuses. A pending known start returns undefined;
unknown starts refuse. Public wrappers report `OwnedControlRequestError` with
code `owned-control-request`, hiding raw storage errors. Returned objects are
detached and recursively frozen. These are reversible internal API conventions.

The trusted synchronous SDK stays available; it can interrupt a lookup, which
then refuses stale evidence. No root export, signer method or service wiring is
added. Nothing signs, sends, releases a reservation or prunes retained state.
Full bounded recovery, startup/memory targets and stable 1.0 remain open.

## First failures and faults

The original fifteen cases all fail before implementation on the absent API.
The expanded seventeen-case population also fails first on that API. The final
population adds a retained-journal alias assertion; its detachment/freeze faults
fail semantically. Eighteen focused and thirty-five combined control/admission
cases pass. The latter precedes that final alias case.

All eighteen control faults catch and restore exact source. The retained
admission campaign initially stops on an ambiguous recursion fault site after
the new reply helper introduces another same-text freeze expression. Preserve
that setup failure without catch credit. Give the control helper's recursive
closure its own descriptive name; the retained admission faults remain exactly
unchanged. All twenty-one admission faults then catch and restore.

Actual disk-read hooks exercise closure and trusted mutation; separate child
hooks delegate to real owned lookup before creating the lookup-to-commit gap.
No fabricated successful evidence is used. Syntax, setup, timeout and signal
output receives no semantic fault credit.

Registry omission fails before adding the new campaign. Definition 29/seed
29531 is declared before full measurement; require the prior 500 selected cases
plus eighteen controls. The first selected-baseline test fails at the exact
518 assertion while its old selected population still executes 500 cases.
Retain that output and add the new test file without removing any prior input.
All waits, limits, coverage/mutation floors and policy/loop coefficients remain.

The installed extension fails first against the actual previous compiled SDK:
`beginOwnedRequest` is absent. No workspace symlink or TypeScript loader is used.
Compiled qualification and full measurement follow below after completion.
The first compiled campaign catches its earlier new trials, then refuses a
freeze trial whose source-text needle does not match emitted JavaScript layout.
Retain that setup failure without catch credit; select the actual unique emitted
freeze call and rerun the complete unchanged campaign after restoration.
The corrected installed population passes all eleven cases; all 106 compiled
faults catch and the restored candidate passes again. Coverage includes actual
compiled owned reads, immutable/captured replies, collision/corruption refusal
and a delegated real lookup-to-commit gap. Source fault, installed compilation
and complete measurement workers do not overlap. `installed-candidate.json`
binds private tarball/source/bin and evaluation-input identities.

Definition 29's full population runs 824 cases, failing the stale exact selected
test inventory assertion. Preserve `full-definition29-first-red.txt` and add only
the new selected test to that independent exact inventory; retain all old items.
Root additionally reproduces D31 on the candidate: replacing public SDK start or
completion methods replaces owned dispatch. `private-method-first-red.txt`
records the failure. Capture both private functions before exposing the guard.
The final population has nineteen cases, with two additional dispatch faults;
every original case/trial remains. Definition 30/seed 30703 and exact selected
count 519 are frozen before final qualification, with no wait/limit/floor change.
The initial definition 29 tarball and manifest are retained separately; they do
not qualify the corrected private-dispatch candidate.

The corrected control/admission population passes thirty-seven cases, including
nineteen controls. All twenty control and twenty-one retained admission faults
catch/restored. The installed D31 regression first fails on the prior compiled
candidate; the corrected installed population passes eleven cases. All 108
compiled faults catch and the restored candidate passes. This retains all 106
earlier trials and adds both mutable-dispatch faults. Final package identities
and definition 30 inputs are bound by `installed-candidate.json`.

## Regenerate

Final definition 31 ordinary and serial AST suites each pass 825 cases; native
typecheck exits zero and every unchanged coverage floor passes. Guard coverage
is 536/556 statements and 451/479 branches. Coverage source digests match the
restored product and private package manifest. The manifest additionally binds
the command bins and frozen evaluation inputs. No full mutation score follows.
All fifteen isolated recovery/driver and fifty-two staging/report faults catch
and restore exact source. Post-campaign verification matches every bound product,
evaluation input and private tarball digest. The full selected 519-case baseline
passes with its original twenty-second wait; the earlier wait failure remains
retained and H11 remains unresolved for hosted qualification.

Definition 30's full run executes 825 cases: 824 pass and the unchanged real
baseline wait expires at twenty seconds. The isolated diagnostic then passes in
about eighteen seconds. Both outputs are retained; an isolated pass does not
clear the full gate or H11. Batch the same six real gap cases in one child process
with independent histories/owners, all prior assertions and exact completion
inventory. Remove repeated runtime startup only. The aggregate child timeout
stays fifteen seconds. Definition 31/seed 31907 precedes the final measurement;
selected count stays 519 and product/package bytes are unchanged. No earlier
failure, case, trial, wait, limit or floor is dropped.

```bash
node --test --test-isolation=none packages/sdk/test/owned-control-request.test.ts
node evals/sdk/owned-control-request-faults.ts
node evals/sdk/owned-request-admission-faults.ts
npm run release:prepare
npm run test:package
npm run test:package:faults
node --test evals/ci/bite.test.ts
node evals/ci/bite-faults.ts
node evals/ci/bite-partitions-faults.ts
npm test
npm run typecheck
npm run test:coverage -- --serial
node evals/ci/mutation-recovery-faults.ts
node evals/ci/mutation-faults.ts
uv run --script tools/session_close.py --slug codex-solanaut-1
```

Run source faults, measurements and isolated baselines sequentially; restore
before the next campaign. No full Stryker score or hosted qualification follows.
The close workflow remains unchanged: local-only commits cannot pass its pushed
HEAD check. This is an explicit user restriction, not a threshold exception.

Pre-commit unchanged close passes nine of ten gates, failing only the uncommitted
tree. Its staged secret scan, claims and knowledge checks pass. Authored code/doc
diff checks pass; raw evidence retains its original whitespace. Local commit and
bundle verification results follow in the continuing run; no push is authorised.
