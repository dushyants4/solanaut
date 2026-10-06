# Completed socket slot recovery — SIG-2/3 correction

Measured 2026-10-05 from `7c42a41`; implementation is the commit containing this receipt.
Linux, Node 26.7.0. Builder-authored local socket evidence; no key or chain send.

A new regression holds the client's half of each completed connection open, then requests
another response beyond the connection cap. Before correction it fails at slot 64 with a busy
response. Shutdown also hangs: the untracked busy connection retains unread client bytes.
The first unbounded run was stopped explicitly. Bounded reproduction prints the assertion and
is then interrupted by `timeout 5 node --test apps/signer/test/socket.test.ts`; retained output
`socket-slots/red-hang.txt`. This is a failed assertion plus shutdown failure, not a clean red run.

Both normal and busy responses now destroy their server socket after the write callback.
The existing trickle fixture initially rejected an EPIPE racing the timeout response, retained
in `socket-slots/fixture-epipe.txt`. It now stops writing when response bytes arrive and parses
the actual received response on close, preserving its timeout code and count assertions.
No missing response is accepted. The half-open fixture also owns a bounded read timer.

`node --test apps/signer/test/socket.test.ts` passes twelve cases (`socket-slots/green.txt`).
`node evals/signer/socket-faults.ts` catches eight mutations, including retaining completed
sockets (`socket-slots/faults.txt`). That mutation produces an ordinary assertion failure and
clean shutdown against the corrected busy path, establishing the maintained regression.
An initial fault selector interpreted its newline escape and did not match source; preserved
in `socket-slots/fault-run-error.txt`, then corrected to a raw string. Source restored throughout.

`npm test`: 278 passes. `npm run typecheck`: exits zero. Signer/helper count unchanged at 390
(`wc -l apps/signer/src/*.ts packages/sdk/src/signing.ts packages/sdk/src/authority.ts packages/sdk/src/control-request.ts`).
Final operational wiring, isolation, full concurrency/kill targets and independent review remain owed.

Control-journal revision `7c42a41` passed CI `37404614332` on Node 22.18.0, 24 and 26.7.0.
The corrective revision's matrix remains separately required.
