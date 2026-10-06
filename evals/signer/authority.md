# SIG-4/10 — host attribution and monotonic clock foundation

Measured 2026-10-05, starting revision `c9a84e0`; implementation is the commit containing this
receipt. Node 26.7.0, Keel 1.0.1, sensor v1. Builder-authored offline tests, no dedicated OS user.

`node --test packages/sdk/test/authority.test.ts apps/signer/test/clock.test.ts`: five cases;
four initially fail and the ordinary SDK compatibility case passes, then all five pass.
Raw logs: `authority/authority-red.txt`, `authority/authority-green.txt`.

`node evals/signer/authority-faults.ts`: five planted faults caught, exact source restored after
each, restored battery green (`authority/authority-faults.txt`). Mutable host configuration,
caller attribution on decisions or reports, non-devnet authority and a changing wall clock
each fail their intended behavioural assertions. No missed fault in this battery.

`npm test` passes 256 tests; typecheck and compiled packed SDK consumer checks pass. Run source
mutation batteries sequentially. No existing assertion was weakened.

The host passes `authority: { mode, clock: { wall, monotonicNs } }` to guard creation. It is
validated and copied before asynchronous initialization. Recorded decisions carry `source:
signer`, mode and clock anchor; reports carry signer attribution. Authority requires a devnet
policy. Ordinary SDK calls retain caller attribution. Restore/replay validate attribution shape.

The clock reads wall time once, then advances using a monotonic delta. Operational factory wiring
must supply it to core and RPC deadlines together. These flags are not proof of OS isolation;
trusted SDK code can construct or bypass its own guard. Unix transport, signed-policy enforcement
in the service, permissions, actual kills and the dedicated-user drill remain owed. The clock and
authority helpers are included in subsequent signer line accounting.
