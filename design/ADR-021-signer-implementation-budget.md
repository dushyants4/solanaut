# ADR-021 · Signer implementation budget

**Status: proposed, not accepted.** 2026-10-06. The human decides. Dependent expansion
of signer startup/key loading waits; independent consumer and validation work continues.

## Context and evidence

ADR-013 and ADR-019 require at most 500 lines. Existing receipts deliberately also count
the signer-specific SDK journal, control-request and attribution helpers, so moving code
into the SDK cannot manufacture compliance. The current partial composition is 501 lines:

`wc -l apps/signer/src/*.ts packages/sdk/src/signing.ts packages/sdk/src/authority.ts packages/sdk/src/control-request.ts`

Of these, 401 are under the signer app and 100 are the counted SDK helpers. This is a
development measurement, not a completed SIG-11 gate. Startup now enforces signed policies,
durable ownership, protected history and shutdown draining, using injected host signing/RPC.
Protected key/configuration loading, an executable, background follow-up, isolated-mode
checks and finalized lookup reads remain required. Six redundant lines were simplified
during composition without deleting checks; that did not provide space for the remaining
work. Further compression solely to reach a line count would obscure security review.

## Proposed decision

Replace the 500-line implementation ceiling with **1,000 physical source lines**, counting
all signer app source and every signer-specific helper regardless of directory. Retain an
explicit list and regenerating command in the receipt. General SDK admission/decoding/state
code already reviewed under its own requirements is excluded, as before. No exclusions for
blank lines, comments, generated wrappers or security-sensitive configuration/key loading.
No moving or renaming code to change the count.

This changes SIG-11 only after human acceptance. It does not change any security, coverage,
mutation, fuzzing, reliability, performance, independent-review, audit or release gate.
The increased ceiling is a reviewability limit, not evidence that the remaining work fits;
measure the complete candidate again. Any further miss returns for a new decision.

## Alternative

Keep 500 and require a reviewed redesign before completing the signer. The present partial
candidate does not pass the recorded conservative count. No candidate is called complete
while that remains true. No checks may be removed to satisfy the ceiling.

## Costs and acceptance

A larger security-sensitive implementation costs more reviewer time and test coverage.
Keep functions small and record all counted files. The specialist audit and independent
red team cover the full source, including extracted helpers. Human acceptance must be
recorded here and in HANDOFF before dependent expansion; protected requirement/harness edits
remain owed to the human or Claude where applicable.
