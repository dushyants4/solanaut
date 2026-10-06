# ADR-020 · Opaque execution, anchors and operator exceptions

**Status: proposed, not accepted.** 2026-10-05. Clarifies incomplete promises in ADR-018,
ADR-015 and PHX-1 before their affected implementation. All execution here is devnet or a local fork.

## Context

An absolute post-simulation balance floor does not bound loss relative to the balance immediately
before execution: an intervening deposit may be consumed while the old floor still passes. Opaque
CPI destination semantics are also unspecified. Immediate event anchors exceed a periodic-only
cost ceiling, and tolerated anchor outages exceed a nominal exposure interval. A Phantom cap
exception needs a narrow authorisation contract while normal rules deny additional signers.

## Proposed decision

### Opaque fallback

Ship the stable default with opaque programs denied. Do not offer an unbounded opaque preset as
protected signing. Keep ADR-018's bounded route as experimental and disabled until a separately
accepted assertion design demonstrates both execution-relative loss and allowed destinations.

The design must cover intervening deposits, writable/delegated/new/closed accounts, authority
changes, fee/rent accounting, simulation/execution drift and stripped assertions. A route that
cannot fit its assertions is denied. If OPQ-6 cannot pass, use the already accepted denial fallback
and report the unavailable capability rather than claiming swaps are protected.

### Anchors

Retain ADR-015's periodic and immediate-event cadence and dedicated anchor-only authority.
Describe the exposure as entries after the latest successful verified anchor, not an unconditional
one-minute bound. Separate periodic transaction estimates from event transactions; event-triggered
cost has no periodic-only ceiling. Display the actual successful-anchor age and missing/error state.

An unavailable anchor does not undo a recorded decision. It raises the existing gap alert and
records the degraded integrity condition. A mismatch with a known on-chain anchor refuses restore.
Initial enrolment and authority rotation require the operator; permission errors cannot bootstrap a
new guard authority automatically. Verify stale/foreign/rewritten-anchor and outage cases before
updating any public claim.

### Operator cap exceptions

An exception is an operator signature over the guard/cluster, policy version/hash, exact transaction
message hash, expiry, unique approval identity and precise cap allowances. Only rules 12, 16 and 18
are eligible; instruction, destination, mint, lifetime, fee, intent and latch denials remain binding.

Reserve the approved value before signing. Persist redemption before exposing the signed result.
Revalidate wallet-returned bytes and the narrow read-only Lighthouse additions, then rerun applicable
rules and fee limits. Changed policy, changed bytes, reused approval or expiry denies. Record the
exception and outcome so restore/replay reconstruct them. The operator co-signing path explicitly
recognises the pinned operator; it does not globally relax the ordinary other-signer rule.

The required cap-exception scenario must work with opaque programs denied. If Phantom's result cannot
be admitted under the narrow assertion rule, stop that milestone and record the incompatibility.

## Evidence, costs and deferred choices

No success is reported here. Add requirement-named adversarial tests for deposit-before-execution,
opaque destinations, concurrent proposals with exceptions, replayed approval, altered bytes,
post-approval policy change, anchor outages and authority rotation. The fork gate remains binding;
no failing gate is waived. Simulation adds latency and account discovery; assertions add size and
compute; exceptions add durable lifecycle state; immediate anchors add variable cost.

This proposal closes the default-release scope and corrects guarantee wording; it does not invent
a proven execution-relative assertion mechanism. Such a mechanism needs its own accepted design
and primary-source verification before enabling opaque execution.
