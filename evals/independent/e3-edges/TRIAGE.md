# E3 edges: triage

The evaluator's report is [REPORT.md](REPORT.md), and is left as it was handed back. This page is the builder's
response to it, written by the session that built the code, on 2026-10-03.

**The black-box audit:** `python3 evals/independent/audit.py <old folder>,<new folder> <transcript>` found 76 tool
calls across both folders, the one cleared by the reboot and the new one, and **0 hits**. The evaluator read nothing
of the repository or the SDK's source.

| Case | Verdict | Triage | Action |
|---|---|---|---|
| E78 | fail | **A defect, D15.** The strip covered only the transactions the wallet returned, not the caller's objects it had signed in place. Both decisions were released as never signed while one was signed: a double payment | fixed test-first: every caller object stripped; a validly signed admission held as `unknown` and followed up. `guardedSigner` had the same gap in another form: a short return went undetected. It now refuses one |
| E22 | fail | **A defect, D16:** the code against §8's text | fixed test-first: `decision: null` on both adapters |
| E52 | unclear | **A gap in the spec:** the clamp at −1 is in the code, not in §6 | §6 now states it |
| E20 | pass on delivery; **fails after D15** | **Superseded by a design change.** E20 expected every decision of a refused batch to be released, as §8 then said. After D15, a batch member the wallet validly signed is held as `unknown` and followed up. A double payment is worse than holding a reservation for at most one blockhash lifetime, on an error path. §8 now says so | §8 rewritten. The archived test keeps the evaluator's expectation; it is not edited |
| benign, varied fees | measured | **A limit of sensor v1, new:** 15 of 3,000 (0.50%, 95% interval 0.30–0.82%) stopped and latched. Fee escalation is scored against landed payments too | claim S7 scoped to constant fees; SPEC §12 open question; `docs/RISKS.md` RK20. No sensor change without a fresh measurement |
| `node --test tests/` | process | **The brief was wrong:** Node 26 needs a glob | `evals/independent/README.md` corrected |

**After the fixes:** the repository's suite passes 154 of 154; this suite, re-run against the fixed code, passes 82 of
83, the one being E20, as above. Rerun from the repository root with
`node --test evals/independent/e3-edges/tests/*.test.mjs`.
