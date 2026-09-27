# ADR-001 · Two defences: a deterministic policy, and Gubernaut Keel for loops

**Status:** accepted 2026-09-27 (setup plan, approved by the human). Refined by ADR-004 and ADR-005;
**point 4 superseded by ADR-006** (2026-09-27): H3 composes with Squads v4 spending limits instead of
building a vault program.

## Context

The drop documents (`Docs-Dashy-Drop/`, triaged in `docs/CLAIMS.md` §3) proposed that
Gubernaut's controller stops prompt-injection wallet drains because an injection makes its
telemetry spike. Gubernaut's own published limits contradict that: the controller acts on
whatever numbers its sensor reports, and its text sensor missed calmly worded hostile input 5
of 5. A calm injection in token metadata is exactly that case.

## Decision

1. **The injection defence is a deterministic transaction policy**: program and destination
   allowlists, per-transaction and per-window caps. It is configuration outside the model, so a
   fully compromised model still cannot sign past it.
2. **Keel handles loops and escalation**, fed by a transaction-level sensor (v0 now, measured in
   H1). It is consumed as `@gubernaut/core` 1.0.1 from npm, digest-checked at startup, never forked.
3. **Allow only if both agree.** Every error denies. Denied proposals still reach the controller.
4. **On-chain enforcement (H3)** repeats the policy in the vault program, so a stolen agent key is
   bounded too.

## Consequences

- The honest pitch is narrower and stronger: "the model can be fully fooled and the wallet still
  cannot pay an address you never allowed."
- Loop-detection quality is the sensor's, and must be measured before any rate is claimed.
- A policy the agent can edit is no policy: the SDK takes it at creation and exposes it
  read-only. Keeping the policy's source out of the agent's reach is the integrator's job.

## Would show this was wrong

A legitimate agent needs destinations that cannot be known in advance (for example, paying
arbitrary users). Then the allowlist becomes a per-call human approval or a program-level rule,
and this ADR is revisited.
