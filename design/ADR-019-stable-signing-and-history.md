# ADR-019 · Stable signing, history and recovery contracts

**Status: proposed, not accepted.** 2026-10-05. Required by the approved Solanaut 1.0 mission
before building the affected parts of ADR-013, ADR-014 and ADR-010. Devnet only.

## Context

ADR-013 promises retry-safe answers after a restart, but a request ID on an admission does not
recover a signature or prove whether a send occurred. The current record also documents a
non-atomic stale-lock takeover. ADR-014 records policies but not the evaluator version. ADR-010
requires both snapshots and replay-derived Keel state; the snapshot authority and trust boundary
are not specified. These are correctness decisions, not permission to change the accepted gates.

## Proposed decision

### Signer lifecycle and transport

- Keep `propose`, `report`, `status` over the protected Unix socket. The agent receives no key
  material. Protected mode requires durable local storage and refuses a missing established
  history; creating a fresh identity is an explicit operator setup operation.
- Namespace a request by guard identity, client identity and request ID. Persist its canonical
  payload digest. Same identity and digest returns the recorded answer; a differing digest is
  refused. A deadline applies to new work, not a completed request's durable answer.
- The durable transitions are admission, redemption, signed bytes/signature, send-started and
  response. Persist and sync signed bytes before persisting send-started; persist send-started
  before invoking the single send. Store denied responses as well as successful responses.
- A restart may send a durably signed transaction only when no send-started entry exists and
  its receipt/lifetime remains valid. Once send-started exists, it never sends those bytes again:
  the send may have reached the node even if the process died before calling or receiving from it.
  Follow chain evidence; retain the unresolved reservation. Availability is sacrificed in this
  ambiguous interval. The caller may inspect status; it cannot force a resend or a new signature.
- A timeout does not roll back admission or make signed bytes safe to release. A caller's report
  is a hint that triggers a chain read, never an outcome. Recovery uses the same reconciler as
  live follow-up. No exactly-once chain-execution claim is made.
- Preserve `guardedSigner` as the existing partial-signing SDK API. Introduce a distinct sending
  client for isolated mode; no method named only `sign` broadcasts. Keep same-user mode explicit
  in status, each decision and the dashboard.
- Keep SIG-11's existing budget: signer-process implementation at most 500 lines, excluding the
  SDK, stated before implementation. Count all signer-process helper files, not only its entrypoint.

### Ownership, versions and operator changes

- On supported Linux deployments, use a kernel-held exclusive lock through the available `flock`
  utility, supervising the writer for its whole lifetime. A crashed owner releases the kernel
  lock. SDK deployments without that protection fail closed on stale ownership rather than
  automatically racing to remove a stale lock. Document the supported filesystem boundary.
- Define record-format and evaluation-profile versions separately. An evaluation profile binds
  rule semantics, sensor definition, Keel version/digests and decoder version. Persist the profile
  beside each signed policy entry. Unsupported profiles refuse restore/replay; never use today's
  rules silently for an older stable record. The accepted pre-Alpha V0-to-C break stays documented.
- Equal policy version is allowed only with exactly the same canonical policy and signed text.
  Different content needs a higher signed version. Policy changes preserve live attempts, used
  receipts, windows and latch. Operator-key rotation is an offline maintenance ceremony authorised
  by the current key and anchored to the guard identity; it cannot be initiated by the agent.
- Upgrade by stopping admissions, verifying a backup, validating format/profile support, restoring
  and checking state, then resuming. A binary rollback must read current policy and history. Reverting
  policy content needs a newly signed higher version, not restoring an older policy file.

### Snapshots and retention

- Stream full replay and archive immutable segments. Keep the unresolved attempts, active windows,
  receipts and bounded sensor view in memory; index historical requests on disk. The dashboard tails
  new entries rather than repeatedly loading the complete history.
- Checkpoint after each 10,000 decisions and on an orderly maintenance stop. Atomically publish a
  canonical snapshot binding guard, policy/evaluator versions, sequence, head, archive digests and
  admission state. Use a dedicated checkpoint-signing key outside the principal, with its public key
  pinned in operator-owned configuration. Do not repurpose ADR-015's anchor-only key.
- A compact authenticated prefix records Keel telemetry and reset events; restore rebuilds Keel
  by replaying that prefix and the subsequent log, never by loading controller state numbers.
  Snapshot signatures authenticate checkpoint state under the signer-host trust boundary; matching
  a tail head alone is not evidence that arbitrary snapshot state is correct.
- Retain full historical segments for independent replay. Verify snapshot and prefix signatures,
  identity, archive binding and tail chain before accepting proposals. On an invalid checkpoint,
  attempt verified full replay; if that cannot establish state, refuse to start. Do not delete an
  archive to manufacture a new empty state.

### RPC boundary

- Pin the devnet identity and configured provider endpoints outside agent control. Put deadlines
  on each read within the request deadline, validate responses and commitment context, and back
  off through rate limits. Never retry sends.
- Maintain two provider health states. Failover must not lower commitment or use older observations
  to release reservations. Disagreement, incomplete history or unavailable outcome evidence leaves
  an attempt unresolved; total loss denies new proposals and reports degraded status.
- The operator's RPC remains a trust assumption, not a Byzantine quorum guarantee. The on-chain
  spending limit remains the cross-process/fleet bound. Document both residuals.

## Acceptance evidence

Requirement IDs to add to SPEC after acceptance: LIF (request/payload/lifecycle), OWN (exclusive
ownership), VER (profile/policy/upgrade), SNP (authenticated snapshots/retention), RPC (network,
timeouts, failover and evidence). Existing SIG/POL and all READINESS targets remain binding.

Kill at every transition, including before/after send-started and lost responses. Race processes
for stale ownership; reuse IDs with changed bytes; inject ENOSPC/short writes. Compare snapshot
restore to full replay across policy changes and all supported runtimes. Corrupt signed snapshots,
prefixes and archives; prove rejection. Test stale, hung, conflicting and rate-limited providers.
Measure startup and memory targets on the predeclared workloads, without redefining them to pass.

## Costs, residuals and deferred work

The conservative send-started rule can strand a valid payment until expiry/reconciliation. Prefix
replay and retained archives consume disk and startup work. A checkpoint-signing key and `flock`
add operational requirements; record the toolchain dependency before using it. A compromised
signer host can falsify a checkpoint, so the external anchor and on-chain limit remain material.
Hardware/remote custody, mainnet and multi-host active writers are deferred. No implementation may
claim these contracts achieved before tests, receipts and the human's acceptance exist.
