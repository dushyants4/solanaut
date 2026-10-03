# E2 state: triage

The evaluator's report is [REPORT.md](REPORT.md), left as it was handed back. This page is the builder's response,
written on 2026-10-03.

**The black-box audit:** 108 tool calls across both folders: **0 hits**. The evaluator disclosed that one uncaught
exception printed a line of the guard's source in a stack trace. That is a tool result, not a read, and the audit
counts only its own calls.

**No case failed.** Four of the seven unclear cases are defects the spec had not ruled on, now closed test-first. Each
became a test in `packages/sdk/test/`, seen failing for the evaluator's reason before the fix.

| Case | Triage | Action |
|---|---|---|
| S83 | **A defect, D17.** A release in the record was applied on restore and replay without its signature being checked, so an edited record could release a latch | `state.ts` verifies each release as the live guard does: the signature, the guard and cluster, the latch's seq, and the expiry against the entry's own time. A forged release now refuses to start, and `replay` names it |
| S36 | **A defect, D18.** A receipt reported `expired` still redeemed, after its value and fees were freed | `redeem` refuses a decision with a final outcome |
| S80 | **A defect, D19.** A release's expiry read the caller's clock | judged, and recorded, on the latest recorded time |
| S82 | **A defect, D20.** With `windowMs` shorter than a blockhash's life, an attempt still able to land left the window cap, and a second payment was admitted beside it | an attempt that a trusted height shows can still land stays in the windows. Without heights, the windows slide as written, so a caller that never sends heights is not held at its cap forever |
| S81 | **A diagnostic.** It refused correctly, with "process undefined on undefined" | the message names the lock file and how to clear it |
| S68 | **Threat T12's stated residual.** A record re-sealed whole restores as written; `replay` finds it | §7 says so; the Alpha closes it at start (ADR-014's policy entries, ADR-015's anchor) |
| S35 | **The spec was silent:** a receipt with an expiry needs a height | §7 says so |
| S77 | **As designed,** and stated in `docs/CLAIMS.md`'s not-claimable list: the D14 hold ends a window after the intent's first attempt | none |

**After the fixes:** `npm test` passes 159 of 159; this suite, re-run against the fixed code, passes 83 of 83. Its
unclear cases record what they observed rather than assert it.
