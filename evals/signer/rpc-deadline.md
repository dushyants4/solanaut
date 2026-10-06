# RPC-2 — owned request deadline across runtimes

Measured 2026-10-05, starting revision `aecdf8e`; correction is the commit containing this
receipt. Node 26.7.0 locally; builder-authored evidence. No real chain send.

CI `37402929454` on `c9a84e0` failed on Node 22.18.0: 250 tests passed, no assertion failures,
one cancelled hung-read test. The diagnostic was `Promise resolution is still pending but the
event loop has already resolved`. Node 24/26 and the office job passed. The newer attribution
step had already been committed when the log was read; it did not fix this inherited failure.

The abort helper's timer was unreferenced. Added a standalone-process fixture with no network
socket handle: before correction it exited with code 13 and never completed the request.
`node --test apps/signer/test/rpc.test.ts` first fails this new assertion, then passes all eleven
cases (`rpc-deadline/rpc-deadline-red.txt`, `rpc-deadline/rpc-deadline-green.txt`). Assertions and
deadline targets were not widened. The product now owns a referenced AbortController timer
through fetch and body reading, clearing it in `finally` on every exit and retry.

`node evals/signer/rpc-faults.ts` now catches eight mutations, including making the owned timer
unreferenced; exact source restored and all cases pass afterward. Evidence:
`rpc-deadline/rpc-deadline-faults.txt`. No missed fault in this corrective battery.

`npm test` passes 257 tests locally; `npm run typecheck` exits zero. The corrected revision's
runtime matrix must pass before it is reported green. Regenerate the Node 22 failure evidence
with `gh run view 37402929454 --log-failed`; current CI carries the standalone regression.

This establishes owned deadline behaviour for the supplied abort-aware HTTP interface, not
arbitrary uncooperative replacement fetchers or a live provider outage drill.
