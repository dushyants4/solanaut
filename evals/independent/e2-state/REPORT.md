# REPORT.md: evaluator E2, the guard's state

> Written by the evaluator (a subagent given only `SPEC.md` and `API.md`) and saved here verbatim from its hand-back:
> its harness refused it the write. The triage is in [TRIAGE.md](TRIAGE.md), kept apart.
>
> **The evaluator's disclosure:** early on, one uncaught exception in a probe printed one line of the guard's source in
> its stack trace. It opened no implementation file, and every expectation comes from SPEC.md.

Black-box, from SPEC.md Draft 4 (§3, §5 rules 4 and 14 to 16, §7, §10 D13 and D14, §11) and API.md. 83 cases in `tests/*.test.mjs`, run with `node --test tests/*.test.mjs` (Node 26 won't take the bare directory). **Verdicts: 76 pass, 7 unclear, 0 fail.**

## Fails
None. Each passing case was built so that a wrong implementation would fail it. Examples:
- **S10, S11:** a window has passed, but the attempt is at its last valid height, or has no heights. Both stay held.
- **S26:** an exhausted intent's retry is counted from its first attempt.
- **S58, S60:** a cut-off last line undoes its own report, and the file reopens after the next append.
- **S64:** a re-sealed record with a wrong Keel posture refuses to start.
- **S71:** a restart before any of 12 default-sensor ops gives byte-identical later entries.
- **S75:** a denied proposal does not use an attempt.
- **S76:** a NaN or Infinity `at` cannot empty the windows.

## Unclear, with minimal reproductions
- **S83:** latch (afterDenials 2). Append `reseal({kind:"release", seq, prev: last.hash, latchSeq, text: guard.releaseText(...), signature: <64 zero bytes, base64>})` and restore through an EntryStore. You get `latched: false`, and `replay().ok === true`.
- **S82:** windowMs 10 s, SOL window 1000. Allow A (1000, lvbh 250) at T. At T+10.001 s and height 125, re-signing A is `intent-in-flight`, but 1000 to another destination is allowed.
- **S36:** allow A, `report(A, "expired")`, then `redeem(A bytes, A.hash, 100n)` gives `{ok: true}`.
- **S68:** allow 1000 under a 1000 window. Re-seal that entry with `amounts.sol "0"` and restore: another 1000 is allowed. `replay` diverges at seq 0 on `amounts`.
- **S80:** latch with the latest decision at T+100 s. Release a text that expires at T+50 s, passing `at = T+10 s`: `released: true`.
- **S81:** write `""` to `<log>.lock`, then call `createGuard({log})`: it throws, and the message says "process undefined on undefined".
- **S35:** `redeem(bytes, hash)` with no height gives `ok: false`.

S77 passes, but carries a question: the D14 hold counts from the intent's first attempt, so a late, unreported attempt can be released.

## Fixes to my own tests
- S78 used `0xde` as garbage, which is a version byte, so the guard rightly said `unsupported-version`.
- S69's kill points are now counted in acknowledgements, not milliseconds, because this disk is slower.
- S51's bad edit is rewritten.

## Last 15 lines of `node --test tests/*.test.mjs`
```
✔ S21 §5 rule 16: at the SOL window cap is allowed; one lamport over is over-window-cap (43.852563ms)
✔ S22 §5 rule 16: a payment drops out of the window only after windowMs, not before (3.467697ms)
✔ S23 §5 rule 16 / §4 Fees: the fee window counts priority and base fees together, to the lamport (5.975966ms)
✔ S24 §7 'Windows run on the latest recorded time': a caller clock that steps back cannot shrink the window (3.399622ms)
✔ S25 §5 rule 15: the intent's attempts are capped at intents.maxAttempts (2.200175ms)
✔ S26 §7 'When an intent ends': an exhausted intent tries again a window after its FIRST attempt, never sooner (1.817691ms)
✔ S27 §11 concurrency battery: 50 proposals in one tick against the window cap admit exactly the cap (file record) (88.957964ms)
ℹ tests 83
ℹ suites 0
ℹ pass 83
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 34311.976188
```
