# Signer RPC boundary

> **Draft 2** · 2026-10-05 · owner: integrator · for: operators and signer developers.
> Evidence: `evals/signer/rpc.md`, claim S20. Register: `kb/DOCUMENTS.md`.

Configure distinct operator-controlled providers outside the agent's write permissions. Remote
endpoints require HTTPS; loopback HTTP exists for local testing. The signer checks the pinned devnet
genesis, confirmed commitment, response shape and nondecreasing context before using observations.
Read failures back off within deadlines. Sends make one request and disable node retries.

Admission reads can fail over to a healthy provider. Total loss denies new work and reports degraded
health. Final outcomes require agreeing committed evidence from both providers. Missing, stale,
conflicting or incomplete evidence leaves reservations unresolved. Neither the caller's report nor
an unseen signature after expiry proves a transaction did not land. This is a provider trust boundary,
not a Byzantine quorum guarantee.

The initial implementation only accepts the provider's currently returned blockhash, so it can
obtain that hash's bounded lifetime itself. Older valid hashes are denied. Differing lifetime evidence
also denies. Test this availability limit during live integration; do not replace it with caller-supplied
expiry. The first reference installation and live two-provider drills remain qualification work.
RPC operations own a referenced timer until fetch and body processing end, then clear it. A
standalone regression covers premature event-loop exit (`evals/signer/rpc-deadline.md`, S22).

The module is tested offline through fake HTTP providers. The service must wire it to the anchored
monotonic clock and protected configuration. It does not yet implement lookup-table reads or a proof
that unseen expired transactions never landed. An absent status keeps its reservation.

Current provider diagnostics have an unresolved redaction gap, D42/S156:
[the local response-body probe](../evals/signer/rpc-redaction.md) shows raw parser
error text in refusals and health. The service's future provider-health wiring
must follow correction and privacy qualification. Synthetic evidence establishes
no actual credential leak or deployed operator/dashboard exposure.
