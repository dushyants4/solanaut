# Installed crash recovery — replay-count finding

2026-10-11 Toronto · builder-authored CI-2 diagnostic, not independent evidence.
Reviewed 7da99f1, current D40/Linux. CLAIMS S140. Maintained gate unchanged.

## Binding and definition

Install the actual private SDK archive offline with scripts disabled outside the
repository, without a workspace symlink. SHA-256:
`55e8753409bb04960271418e1a3d907b8f3130ff16c10a0a143080be50af489d`.
Freeze original runner, child, workload, craft/kit helpers, lock, product and new
diagnostic before measuring. Only imports, child location and scratch paths
relocate for the original profile; its seed, cases and deadline stay unchanged.
Reference craft/kit helpers remain explicitly bound repository dependencies.

Original seed 202610061 tests the existing gate. A separate proposed-copy
analysis change uses predeclared fresh seed 202610113. Both retain the original
100-trial floor, 160-step workload and ten-second child acknowledgement deadline.
No workload coefficient or policy tuning occurs. Fixed synthetic in-memory
operator fixtures only; no actual key file, RPC, signing service or send.

## Confirmed miss before proposed correction

In an isolated installed guard, replace replay with a fabricated successful
result containing zero replayed decisions. The original battery still completes
100 actual acknowledged SIGKILLs and 100 recovered histories, then exits zero
and reports 100 replays. Its `ok` check never examines `decisions`.

This is a gate completeness finding under a planted backend fault, not a
production replay defect or remote exploit. Earlier healthy recovery evidence
remains intact. Preserve the complete passing false-completeness output alongside
the proposed-copy failures; do not label the maintained gate corrected.

Exact owner edit: before incrementing `replayed`, assert that the returned
decision count equals the number of decision entries in the completed journal.
The exact replacement is in `installed-kills/owed-edit.txt` and HANDOFF O9.
No maintained source, seed, deadline, assertion or readiness target is changed.

## Separate proposal proof

Before healthy controls, the proposed copy refuses three isolated installed
faults: successful zero decisions, successful one decision, and unsuccessful
replay. Each exits one after its first actual kill/recovery; these negative runs
are deliberately incomplete populations. The count faults expect 115 decisions.

Restore exact installed bytes. Existing Node 26.7.0 and 24.19.0 each complete
100 actual kills, recovered histories and replay checks on the fresh proposal
seed. Four original control cases and typecheck pass. Bound inputs remain
unchanged, temporary consumer is removed and the owned job completes.

```sh
uv run --script evals/release/installed-kills.py
node --test evals/ci/kills.test.ts
npm run typecheck
```

An existing definition refuses overwrite; preserve this directory before a fresh
generation. Full raw outputs, relocated sources and hashes are retained here;
owned job/completion and actual trial journals are under `.sandbox/installed-kills/`.
Every subprocess owns a group; timeout cleanup kills that group rather than
leaving its crash-test children alive.

## Limits

A consistent returned count cannot prove that an untrusted implementation
executed replay. These checks still trust the replay backend; independent
semantic/frozen-head controls remain necessary. Identical producer/reference
faults can evade self-comparison. This proposal addresses only counter consistency.

Acknowledged-prefix process death is not power-loss durability, unacknowledged
writes, isolated-user restart, signing/send recovery, exclusive competing startup,
snapshot restore, bounded state or the required restart performance profile.
Node 22, full native/AST/mutation/hosted gates, soak, independent reviews and
external release work remain. H11 still fails the native baseline. No protected
edit, milestone advancement or stable-release qualification follows.
