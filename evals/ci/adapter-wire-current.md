# Maintained fault qualification of D39

Builder-authored local evidence, 2026-10-10 Toronto, Linux/Node 26.7.0.
Exact product revision 71a1ef444f55ee636ddec66618b3b11bd104946e.
Run the actual unchanged `npm run test:bite`, without partitioning, concurrent
qualification, compile cache, generated replacement or changed process limits.

All 65 campaigns start; final runner JSON reports failure in
`ci/mutation-recovery-faults.ts` and `packaging/faults.ts`, with no skipped
campaigns. Mutation recovery fails its original healthy staged baseline before
fault trials: the existing H11 wait remains insufficient. The packaging output
stops before its completion marker and the runner reports it failed. This
invocation does not emit child termination detail; earlier S110 timeout
diagnostics remain distinct evidence, not an inferred exit for this run.

The dedicated background runner PID/group 3697594 terminates naturally. Its
shell launch returned zero before completion; that is not the worker exit or
a pass. The actual aggregate result is the preserved final JSON. No exit code
was captured separately. Full output is archived in adapter-wire-current/full.txt.

Afterwards all 51 bound product and 93 evaluation files match the candidate.
One of 86 emitted files, request-index.js, differs after the failed campaign.
Preserve those bytes and the mismatch manifest before rebuilding with the
unchanged release command. All bound source/evaluation/emitted identities then
match, as does the original private archive digest. Restored typecheck passes.
The full native suite passes all 895 cases after restoration (`npm test`);
that success is separate from the failed fault qualification.
Restoration does not turn the failed maintained qualification into a pass.

```bash
npm run test:bite
npm run release:prepare
npm run typecheck
```

The raw aggregate output, interrupted emitted module, before/after identity
manifests and rebuild/typecheck outputs are retained beside this receipt.
Earlier S119 native, installed, source/emitted fault and quiet coverage passes
retain their component scope. No complete maintained/hosted CI, H11 acceptance,
independent security, milestone or stable-release qualification follows.
No protected gate, timeout, test population, source or threshold changes.
