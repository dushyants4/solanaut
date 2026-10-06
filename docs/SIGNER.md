# Signer development and trust boundary

> **Draft 5** · 2026-10-06 · owner: integrator · for: operators and signer developers.
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
