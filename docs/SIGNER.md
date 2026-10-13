# Signer development and trust boundary

> **Draft 10** · 2026-10-13 · owner: integrator · for: operators and signer developers.
> Register: `kb/DOCUMENTS.md`. The operational service is still being implemented.

The executor and devnet RPC boundary live under `apps/signer/src/`. Their current evidence uses
fake RPCs and reconstructed restart states (`evals/signer/core.md`, `evals/signer/rpc.md`). The
checked journal records signed bytes, send-started intent and immutable responses in the admission
chain. Send-started is an ambiguity boundary: recovery never sends those bytes again.

Host attribution is supplied through `authority` at guard creation. Recorded signer decisions
carry the deployment mode and an anchor with wall time and monotonic nanoseconds; reports identify
the signer as their source. The clock advances from that anchor rather than rereading wall time.
The service must use the same clock for admission time and RPC/transport deadlines. Evidence:
`evals/signer/authority.md`, claim S21.

`same-user` mode leaves the key reachable by other code running as that user. The supported
isolated deployment requires the dedicated signer account and protected directory/key permissions
specified by ADR-013. An attribution flag alone cannot establish those permissions. The human's
OS-user creation and isolation drill remain required.

The service will require persistent kernel ownership, established history and externally pinned
signed policy authorization. Its socket methods remain only `propose`, `report` and `status`.
SDK journal methods are trusted host APIs and are not exposed as socket methods. Installation,
protected configuration and installed-package qualification remain in progress.

`socket.ts` now supplies a Linux transport boundary, tested with real local sockets (S23,
`evals/signer/socket.md`). Requests are exactly one canonical `JSON.stringify` object and a
newline, at most 16,384 bytes. Duplicate keys, additional fields, invalid UTF-8 and multiple
frames are refused. IDs use the request identity alphabet; each method has its own field set.
Connections have an absolute deadline, not an activity timeout, and responses are bounded.
The core must still validate request deadlines and persist valid identities and responses.

The parent must be owned by the service user, mode 0750 and free of symlink ancestors;
the socket is 0660. At most 64 active connections are accepted. Normal and busy connections
are destroyed after their response write callback, so clients cannot retain completed slots
by holding their half open (S25). Only after holding the
record's exclusive kernel ownership may a service recover an owned abandoned socket;
a live listener or non-socket path is refused. The transport helper does not acquire that
ownership itself. Closing a timed-out connection does not rewind signing work already
dispatched: retry/recovery uses the journal and never automatically resends uncertain bytes.

`handler.ts` now connects control requests to the journal and host actions (S26). It coalesces
identical active requests, refuses cross-method identity reuse, and returns completed answers
before checking retry deadlines. New expired requests and unavailable control work have fixed,
durable denial replies. Report hints use the request deadline through the chain read and outcome
recording; callers never supply an outcome. The operational service must supply a safe status
projection and its anchored clock. Pre-admission proposal errors now have durable refusal
payloads and answers (S27). Interrupted refusal starts complete conservatively without invoking
the executor again. Errors after admission remain governed by signing history. This has local
evidence; the operational lifecycle and full kill/outage programmes remain required.

`core.recover()` returns `{ decision, complete }` for each recorded admission request.
An attempt failure does not abort later requests, and signed bytes still receive chain
follow-up after a failed pre-send operation (S28). Incomplete results expose no exception
details and must produce degraded host status. Completion describes the pass, not landing
or reservation resolution. Hosts must separately check unresolved attempts and storage
readiness: a failed writer stays closed. Background retry/backoff and operational startup
remain owed; evidence is `evals/signer/recovery.md`.
Signed-policy recovery now has pending-stage evidence (`evals/signer/policy-recovery.md`,
S29): old-policy admission/signed records cannot send after an upgrade, and unresolved
reservations remain counted. Final chain reports prevent subsequent signing or send intent,
including on replay. An interrupted signed response completes as uncertain without sending;
read its separate final report for settlement. Unknown reports leave the lifecycle unresolved.

`startSigner()` now composes those pieces for explicitly trusted same-user hosts (S30).
It requires valid signed authorization and existing protected history, takes kernel ownership,
restores with the anchored clock and recovers before listening. Close drains socket and host
recovery work before releasing ownership. Host-provided signing/RPC must respect deadlines.
Operator status exposes policy/guard/recovery state and explicitly says key isolation is false.
Socket status projects mode, keyIsolation, recoveryIncomplete and degraded. Socket
denials expose only status/class/reference, including historical retries and full
development policies; private journal evidence is unchanged. Background follow-up
uses the same recovery path, coalesces overlapping passes, backs off on incomplete
passes, and cancels/drains before releasing ownership. The native executable now
loads protected configuration and its devnet key, constructs the RPC boundary,
then starts the same-user service. Dedicated-user deployment and installed release
artefacts remain owed. Earlier factory evidence: `evals/signer/service.md`.
The human accepted ADR-021's larger budget, now reflected in SIG-11; all signer
app source and signer-specific helpers count. The complete running candidate
still needs its explicit source inventory. No release gate is marked achieved.
The SDK's distinct sending client consumes this socket protocol (`docs/CLIENT.md`, S31).
The client/service integration is tested with fake RPC; the client has no signing key or
partial-signing methods. The existing signing adapters retain their SDK semantics.

## Native same-user candidate

This is a development executable, not the installed stable release. Use the
approved native Node runtime from TOOLCHAIN. Keep its protected files outside
the model's tool context; same-user code can still read them.

Prepare an owned, real config file at an absolute path, mode 0600 in a 0700
directory. Its exact fields are `cluster: "devnet"`, absolute `keypair`, `record`
and `socket` paths, `policy`, and `authorization` from the operator-signing
workflow in [POLICY](POLICY.md). It contains no RPC URLs or credentials. The
key file must be made with `solana-keygen`, mode 0400 in an owned real 0700
directory, and match the policy's sole principal. The history directory is 0700;
the socket directory is 0750. Symlinked paths and linked key files refuse.

Create the new history explicitly, once:

```sh
node apps/signer/src/main.ts --same-user --config /absolute/config.json --init
```

This refuses an existing record and never clears one. Configure the operator's
distinct devnet RPC endpoints through SOLANAUT_RPC_A/B in the environment, then:

```sh
node apps/signer/src/main.ts --same-user --config /absolute/config.json
```

The ready line reports `same-user` and `keyIsolation: false`, without key or
endpoint data. SIGTERM/SIGINT request orderly draining. After a kill, restart
with the same protected config/history; keep the original request ID and bytes.
Never delete history to get past a refusal or create a new payment ID to resolve
uncertainty. Agent status is coarse; inspect the operator's record for details.

Native startup uses bounded descriptor reads, complete keypair validation and
fixed-category failures. `signer startup refused` deliberately omits underlying
input/endpoint text; inspect permissions, paths, signed policy and the operator
environment locally. The SDK's installed-package evidence does not qualify
this executable's distribution, dedicated-user isolation or Linux lifecycle.
