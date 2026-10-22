# ADR-021 · Signer implementation budget

**Status: accepted by the human on 2026-10-13** (proposed 2026-10-06; `docs/HANDOFF.md` §5, H9). **Amended 2026-10-22,
accepted by the human the same day:** the ceiling is 2,000 lines as formatted (below).
SIG-11's ceiling becomes 1,000 physical lines, counted as below. The edit to `docs/SPEC.md` comes first.

## Context and evidence

ADR-013 and ADR-019 require at most 500 lines. Existing receipts deliberately also count
the signer-specific SDK journal, control-request and attribution helpers, so moving code
into the SDK cannot manufacture compliance. The current partial composition is 501 lines:

`wc -l apps/signer/src/*.ts packages/sdk/src/signing.ts packages/sdk/src/authority.ts packages/sdk/src/control-request.ts`

Of these, 402 are under the signer app and 99 are the counted SDK helpers. This is a
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

## Amendment, 2026-10-22: count the code as formatted

**Accepted by the human on 2026-10-22**, when the code was reshaped to the house style (`STYLE.md`).

The budget was being met by density. The counted files were written several statements to a
line with few spaces: 623 physical lines on 2026-10-22, against the 1,000 allowed. That is the
compression this ADR warns "would obscure security review". Formatted one statement per line,
with Prettier 3.6.2 at a print width of 120, the same code is 1,231 lines; the files' new opening
comments make it 1,260 (`evals/signer/sig-11-formatted.md`).

**Decision.** SIG-11's ceiling is **2,000 physical lines, counted on the code as formatted** with
those settings, by the same command, over the same files, with the same rule: no exclusions for
blank lines or comments, and no moving or renaming code to change the count. 2,000 gives the
formatted code the allowance 1,000 dense lines gave: the ratio measured here is 1,231 to 623,
and 1,000 dense lines scale to about 1,976. It is a reviewability limit, as before, and no other
gate changes.
