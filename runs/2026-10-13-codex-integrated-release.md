# 2026-10-13 — integrate the release path

## Asked

Resume under Claude's review and the human's accepted decisions: integrate the
prepared corrections, remove stale worktrees, specify the accepted contracts,
then build denial disclosure and the running signer. Push only main.

## Did

Read the review, revised handoff, Claude's record and root instructions. Both
live fence probes were refused and no probe file exists. Fetched origin; main
starts clean at 6fd36da9308d1d244450b894832538a568bac3b6. Baseline is running.

Baseline completes: all 901 tests pass and typecheck is clean. Integrated the
preserved batch membership and RPC diagnostic corrections after reproducing
five failures in seven regressions. Combined checks pass 55, full tests pass
908 and typecheck passes. Five omissions and the eight existing RPC faults are
caught with exact source restoration. Compact receipt names raw hashes.
Committed and pushed main as 5db0515; CI run 38435674371 starts. Verified stale
worktree statuses against the review, including dependency symlinks to this
repository. Request-index source files match main; replay drafts are older,
with their reseal corrections and added cases already in main. A stricter
byte-match-to-committed-history check fails because the old receipt was an
uncommitted draft, not a new change. Read the actual differences, then removed
the three reviewed worktrees and branches; none was pushed. Freeze accepted
signer budget, anchor namespace/ceremonies, failure profile and disclosure
contracts in SPEC before their implementation. Unrecorded refusals use -1;
callback failures are fixed stderr operator records outside the decision chain.

### Partner response

The corrected review now states the Token-2022 admission dependency and the
Phantom broadcast blocker accurately. I have no further factual correction to
its milestone verdict. The existing signer factory can serve a tested socket,
but that is not an executable, protected key loader or deployed signer.

I agree that component evidence outgrew integration. The previous native-green
rule required deferring the prepared fixes while the harness wait failed;
that explained the deferral but did not justify burying its cost or continuing
publication inventories indefinitely. I will integrate the fixes now, keep
new receipts small and replace per-checkpoint backup rituals with main pushes.

The review's source count excludes signer-specific SDK helpers; the accepted
budget must still include them. Same-user execution remains distinct from
key isolation. Denial classes reduce model-visible information but cannot hide
SDK state from code in the same process or prevent inference. Full disclosure
and callback failures need explicit record semantics before implementation.

The remaining CI faults require Claude's protected runner edits. I will track
those jobs while progressing the next authorised item, preserving every
currently passing job. I propose no change to the revised work order.

## Changed

Integrated wallet batch membership and fixed RPC diagnostics, then removed the
reviewed stale worktrees/branches. Accepted SPEC contracts precede their code.
SDK adapters now expose class/reference errors and private operator callbacks;
signed development disclosure is marked and replay-checked. The operator demo
reads its private journal and no longer calls an uncertain send "not sent".
The native executable loads protected key/config inputs and starts the service;
explicit init preserves existing identities. A keygen-backed process kill/restart
against fake providers retains one signature/send and follows settlement.
Transport failures now use the class channel too; execution uncertainty remains.
The running same-user service now projects socket replies and follows signed
attempts automatically, coalescing passes and draining/cancelling before close.
Source, installed-package and unchanged serial coverage checks pass; preserved
service/client campaigns retain their original fault sites and populations.
Receipts bind local tests, first failures and omission faults without raw logs
in Git. No stable milestone is claimed; next is the running signer.

Exact owed mutation edits (O11, additive scope, Claude's gate):
- `evals/ci/mutation-stage.ts`, source-list suffix:
  `"owned-guard.ts"].map(name=>"packages/sdk/src/"+name)` →
  `"owned-guard.ts","errors.ts"].map(name=>"packages/sdk/src/"+name)`.
- Same file, test-list suffix:
  `"owned-guard"].map(name=>"packages/sdk/test/"+name+".test.ts")` →
  `"owned-guard","disclosure"].map(name=>"packages/sdk/test/"+name+".test.ts")`.
- `evals/ci/mutation-stage.test.ts`, source expectation suffix:
  `"owned-guard"].map(name=>"packages/sdk/src/"+name+".ts")` →
  `"owned-guard","errors"].map(name=>"packages/sdk/src/"+name+".ts")`.
- Same test, test expectation: the identical test-list replacement above.
Retain every prior input, score floor and deadline. Freeze the next definition
and fresh seed before its run; no mutation score is claimed by source faults.

Exact owed running-path workflow addition (O12, Claude's gate): immediately
after the existing installed-package test step in each runtime job, insert:
```yaml
      - name: running signer disclosure and follow-up faults
        run: python evals/signer/followup-faults.py
```
Preserve all earlier steps, the runtime matrix and job limits. This is an owed
addition, not permission to run past a limit; combine with package remediation.

Exact owed native-source workflow addition (O13, after O12):
```yaml
      - name: native signer key/config/transport faults
        run: |
          python evals/signer/executable-faults.py
          python evals/signer/transport-faults.py
```
The separate `node --test evals/signer/process.test.ts` requires an owner-approved
job with the pinned existing Solana keygen toolchain. No implicit installation,
skip or deadline increase is authorised here. Original campaigns remain intact.

Exact owed claim-placement check (O14): immediately after `own = rows(s1)` in
`tools/claims_lint.py`, insert:
```python
    own_ids = {cid for cid, _ in own}
    errors += [f"{cid}: Solanaut claim is outside §1" for cid, _ in rows(text) if cid.startswith("S") and cid not in own_ids]
```
Add this entry to the existing FAULTS dictionary, retaining every prior case:
```python
    "an own claim outside §1": GOOD + "\n| S3 | orphan | **measured** | missing |\n",
```
Owner qualification must observe its initial failure and restored pass; no
source gate edit is applied here.

## Found

The new measured row was initially appended outside CLAIMS §1. Lint checks its
paths but does not count/validate that own claim; move it into the own-claim
section. Its status/date/commands remain unchanged. An additive owner check for
misplaced S-rows is owed, so a future placement mistake cannot pass silently.

Transport refusals still used diagnostic codes rather than the accepted channel
(D45, missing class/reference). New tests fail first; existing assertion changes
retain every frame/identity/timeout/slot check and are in the single current table.
No private policy value was found in those old fixed codes. The final native,
compiled SDK, serial coverage and source fault controls pass without gate changes.

The new descriptor prototype misses parent mode changes during a read (D43,
parent permission loss). A real public-file regression fails first; recheck its
owner/mode after reading. The native provider decodes before admission, exposing
D44, invalid proposals misclassified as retry-later. Immutable syntax projection
corrects that channel without changing journals or decisions; its regression
fails first and includes a durable retry. A negative reference means no associated
decision for this refusal, not proof that no earlier admission/signature exists.
The first real-process fixture provides the wrong blockhash, so observation
correctly refuses before send; preserve the failure and match the crafted hash.
Instrumented subprocess warnings break exact diagnostic assertions. Disable
runtime warnings only in those test children; production needs no loader flags.
The first short-read fixture ceiling is below its own public JSON size; correct
the fixture and check the inclusive boundary. An initial mode-check omission
escapes malformed key-file tests (also masked by the post-read check); add a
valid public descriptor and prove unsafe modes refuse before any byte read.

Pre-commit claim lint refuses the new follow-up row because it only links the
receipt's commands. Add literal regenerating commands to that row; no claim or
lint rule changes. The remaining pre-commit close failure is the uncommitted tree.

The new follow-up fault campaign catches denial/status leaks, then its omitted
scheduler exposes an unbounded drain-test wait. The runner restores source on
timeout; process inspection finds no surviving worker. Initial partial timeout
output was not retained, which is stated in its diagnostic. Bound the test wait
and the runner's owned process group; retain the initial script and earlier logs.
The existing sending-client fault gate freezes named-test count. Keep added
negative denial cases within its existing response-shape test, removing no case;
retain its count and all original faults. Service fault sites also remain intact.
Status must not expose the rule-named latch flag; only the operator retains it.

The first disclosure full run fails old private error-field assertions, not
transaction-safety behaviour. Their operator-side replacements are listed once
in the current review table; all original first failures remain retained.
The optional coverage run used the default concurrent command rather than CI's
accepted serial command. Its staged baseline exceeds the unchanged harness wait
under that load. Preserve the failure; qualify the actual hosted serial command
after it finishes. No timeout, population or threshold changes.

Package fault jobs still need Claude's parallel runner and termination edits;
this does not suspend the revised product queue. No gate is weakened here.
The new fault runner initially demanded AssertionError, but omitting caller
capture correctly causes SolanautDenied. Preserve its script/output and accept
that exact error for that one fault; no product assertion changes.
Pre-commit close passes all checks except the expected uncommitted tree. Diff
review and credential-shaped scan find no secret; only main will be pushed.
The pre-change hosted run 38390912158 is failed; its jobs are checked separately
from the passing local source qualification. No hosted logs are committed.
The SPEC-only step leaves product source/tests unchanged after the 908-test
pass. Link/claim checks and close pass except the expected dirty tree. A combined
staging/close command triggers the protected-path heuristic before execution;
split the commands as the boundary instructions prescribe. No bypass or gate edit.

## Open

The native same-user signer now runs with protected key/config loading and a
scoped real process-kill rehearsal against fake providers. Live devnet still
needs operator RPC/config; dedicated-user checks remain human-owned. Complete
finalized lookup handling and the full signer reliability batteries, then the
signed-policy and Token-2022 queue. Hosted runner
edits remain Claude's; package publication, funding and OS users are human-owned.

The SIG-8 native-kill contract and driver are committed at 437a761. A 12-boundary pilot passed after shortening the
Unix socket path to fit Linux's address limit. The frozen 100-case run is active in PID 2202034; its output and exit
status are under `.sandbox/evidence/2026-10-13-development/`. This is qualification work, not a release claim.

## Provenance

Builder-authored evidence. Baseline output is retained under
`.sandbox/evidence/2026-10-13-development/`; receipts bind commands and hashes.
Earlier failures remain intact. No historical branch or tag is pushed.
