# E1 decode: triage

The evaluator's report is [REPORT.md](REPORT.md), left as it was handed back. This page is the builder's response,
written on 2026-10-03.

**The black-box audit:** 74 tool calls across both folders, the one cleared by the reboot and the new one: **0 hits**.

**No defect in the code.** Every decision matched the spec. What the evaluator found is where the spec was imprecise,
and the spec now says what the code does.

| Case | Verdict | Triage | Action |
|---|---|---|---|
| S02 | fail | **The spec's formula was imprecise.** The code sorts `signers` and `opaque`, and puts each outflow in `sol` and `tokens` as its own canonical JSON string, sorted, so the key does not depend on instruction order. Recomputed independently from that description, it matches | §3 and §4 state the formula exactly |
| X10 | unclear | the instruction's program, as observed | §4, "Rules for tokens": the pair (mint, the program the instruction runs under) must be listed |
| U01 | unclear | rule 10 first, as observed: without a mint, no destination can be recognised as an associated account | §4, "Rules for tokens" |
| U02 | unclear | capped, as observed: the runtime caps an explicit limit too | §4, "Fees" |
| U03 | unclear | yes, as observed | §4, a new "Programs" paragraph: decoding decides how a program is read, not whether it may run |
| U04, U08 | unclear | `malformed-proposal`, as observed | §4, "Message versions": what Solana could not execute does not parse |
| U05 | unclear | `destination-not-allowed`, as observed | §4, "The principal": not a destination unless listed |
| U06, U07 | unclear | `malformed-proposal`, as observed; the 256-character bound is the code's | §3's `intent` and §5's rule 1 state both |
| rule 0 | note | "the fee payer" is untestable as written: the fee payer is always a principal key | §5's rule 0 row reworded |

**After the triage:** this suite still has S02 failing, because it encodes the formula as the spec first stated it.
The test is left as the evaluator wrote it. The spec's new text was checked by an independent recomputation, which
matched.
