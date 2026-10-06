# Recovery pass isolation — LIF-6, SIG-7/8

Measured 2026-10-06, Node 26.7.0, Keel 1.0.1, sensor v1. Revision: the commit
containing this receipt (`git log -- evals/signer/recovery.md`). Builder-authored
fake-RPC and reconstructed-history evidence, not independent qualification.

## Failed first

`node --test apps/signer/test/core.test.ts`: four new cases failed, thirteen existing
cases passed (`recovery/red.txt`). An expired admission, provider loss, expired signed
bytes or response-write failure aborted recovery. After implementation, one fixture
assertion still failed: its second payment reused the first payment's in-flight intent.
A distinct amount and explicit admission/sent assertions correct the fixture; no original
assertion was removed or weakened. The first post-implementation output was overwritten
in scratch; its failure and correction are recorded here rather than claimed as retained.

## Now

The same command passes seventeen cases (`recovery/green.txt`). Recovery returns a
decision/completion result per recorded request; an attempt failure does not stop later
attempts. Signed bytes receive chain follow-up even after failed pre-send recovery.
Incomplete results contain no exception details. They do not release reservations,
persist fictitious outcomes or authorise resends. Failed storage remains closed.
Completion means this pass's proposal and follow-up operations completed, not that the
transaction landed or its reservation resolved. Hosts must separately inspect unresolved
attempts and storage readiness and display incomplete work as degraded.

## Faults

`node evals/signer/recovery-faults.ts` catches four maintained faults: abort on error,
hide an attempt error, skip chain follow-up after refusal and invent recovery success.
`node evals/signer/core-faults.ts` catches the six existing faults. Outputs are retained
in `recovery/faults.txt` and `recovery/core-faults.txt`. Both restore source in `finally`
and verify the restored battery. No missed fault in these runs.

## Limits

Operational startup, policy-change recovery, actual process kills, protected key/configuration
loading and bounded background reconciliation remain owed. This pass still scans in-memory
history. Partial signer/helper count is 459 lines, regenerated with
`wc -l apps/signer/src/*.ts packages/sdk/src/signing.ts packages/sdk/src/authority.ts packages/sdk/src/control-request.ts`.
The final 500-line budget and every existing release threshold remain unchanged.

Full verification: `npm test` passes 299 cases (`recovery/full.txt`),
`npm run typecheck` exits zero, and `npm run test:package` passes four installed
consumer checks (`recovery/package.txt`). Pre-push close has only the pending-tree
failure; post-push close and CI are recorded in the continuing run record.
