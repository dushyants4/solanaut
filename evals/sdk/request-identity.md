# LIF-1 — admission identities and payload binding

Measured 2026-10-05, starting revision `033cd87`. Implementation revision is the commit containing
this receipt. Node 26.7.0, Keel 1.0.1, sensor v1; builder-authored offline SDK evidence.

## Failed first, passes and fault evidence

`node --test packages/sdk/test/request-identity.test.ts`: eight tests failed against the old API,
then eight passed. Raw logs: `request-identity/request-red.txt`, `request-identity/request-green.txt`.
The cases cover allowed and denied duplicates, unchanged controller/reservation state, used
receipts, changed message/group, client namespaces, invalid identity, persistent restart and
resealed digest/guard/duplicate history rejection in both restore and replay.

`node evals/sdk/request-faults.ts`: four faults caught, with complete batteries and behavioural
assertion failures. The runner restores exact bytes after each mutation and passes again.
Raw summary: `request-identity/request-faults.txt`.

| Fault | Rejected by |
|---|---|
| bypass retry lookup | duplicate returns original decision with no additional state |
| ignore changed payload | changed bytes/group must be refused |
| skip recorded binding validation | resealed digest and foreign guard rejection |
| accept duplicate recorded identity | duplicate history rejection |

No fault miss in this battery. Run source mutation batteries sequentially.
`npm test` passes 220 tests; `npm run typecheck` exits zero. Packed consumer checks are rerun
after compilation. This is not independent RT-2 evidence or complete SIG-3 qualification.

## Decisions and remaining work

`guard.check(proposal, { clientId, id })` commits optional identity metadata in the decision
itself, including a denial. The guard namespace comes from its policy identity; it derives the
digest from canonical message bytes and grouping. Authoritative time/heights and transport
deadlines are not caller payload. IDs use bounded ASCII identifiers. Existing calls are unchanged.

Duplicate lookup happens before evaluation, so it does not tick Keel or reserve again. Returning
an old admission does not create a fresh redeemable receipt. A changed payload returns an
unrecorded fail-closed denial. Recorded bindings and duplicate identities are checked on restore
and replay. No existing assertion was removed or weakened.

Full historical request lookup remains in memory, explicitly pending the accepted disk index.
The signer must still enforce deadlines, durable signed bytes, send-started and final responses,
chain reconciliation, process isolation and no-resend behaviour. Admission idempotency is not
exactly-once chain execution. No signing or sending capability is delivered by this step.
