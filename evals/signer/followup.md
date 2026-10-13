# Class-only socket replies and automatic follow-up

2026-10-13 Toronto · builder-authored Node 26.7.0/Linux evidence, S159.
Starting revision 62a416fbdb32dbd95be86e9cdb3deba2e652e5ef; the implementation
revision is the commit containing this receipt. No independent or release credit.

The actual same-user service now projects private signing/control journal replies
at its socket boundary. Denials use status/class/reference even under signed full
development policy and on historical retries. Operator status keeps policy and
latch state; agent status carries only deployment and recovery/provider health.
The SDK sending client accepts the new denial shape and refuses legacy denials
or additional private fields. Private journal formats remain unchanged.

Automatic follow-up uses the startup recover/report path, coalesces passes, and
backs off when a pass is incomplete. It never resends after send-started. Close
cancels the timer and drains dispatched work before releasing kernel ownership.
Actual sockets prove landed reporting without a caller hint, plus shutdown
draining. Mocked timer ticks separately prove increasing waits through repeated
provider failure, without new sends or final reports; this is not real timing
or devnet reliability measurement.

All five initial integration cases fail. The final expanded file passes nine;
combined service/client checks pass 28. The first candidate also fails two old
status/denial-shape assertions; their accepted contract changes are in the single
current assertion table. Additional negative response cases stay within the
maintained client's original named-test population, removing no case.

Seven new source faults are caught: private denial/status, omitted scheduling,
uncancelled timer, absent backoff, overlapping recovery and private client fields.
An initial missing-scheduler run times out on an unbounded test wait; preserve
its runner and diagnostic, state that partial child output was not retained,
then bound that wait and the runner's owned process group. No worker survives.
All seven rerun faults fail by assertion; exact source is restored and the
combined population passes. All eight original service faults and seventeen
original sending-client faults still pass their unchanged campaigns.

Full `npm test` passes 960 without skips/cancellation/todo; typecheck passes.
The compiled installed-package population passes 19 and the exact serial AST
coverage command passes all unchanged floors. Installed tests cover package
consumption, not a separate deployed signer or privacy battery.

```sh
node --test apps/signer/test/disclosure-followup.test.ts apps/signer/test/service.test.ts packages/sdk/test/sending-client.test.ts
python evals/signer/followup-faults.py
node evals/signer/service-faults.ts
node evals/sdk/sending-client-faults.ts
npm test
npm run typecheck
npm run release:prepare
npm run test:package
npm run test:coverage -- --serial
wc -l apps/signer/src/*.ts packages/sdk/src/signing.ts packages/sdk/src/authority.ts packages/sdk/src/control-request.ts
```

The conservative current inventory totals 525 physical lines: clock, core,
handler, RPC, service and socket plus SDK signing, authority and control-request.
It includes blanks/comments. General shared SDK rules and the agent-side client
are excluded as specified by ADR-021. The incomplete executable/key-loading
candidate is not a completed SIG-11 or 3.1 claim.

Raw output remains under `.sandbox/evidence/2026-10-13-development/`, hash-bound
by `followup-inputs.json`; no hosted logs are copied. Hosted run 38445834857
preserves the previous green jobs, with unchanged runner failures remaining.
A read-only devnet balance command finds the agent funded for a small smoke test,
but this session has no configured pair of signer RPC endpoints. No chain send
occurs. Protected key loading, the executable, real kill/restart qualification,
finalized lookup-table reads and dedicated-user isolation remain outstanding.
