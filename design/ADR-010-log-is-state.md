# ADR-010 · The decision log is the guard's state

**Status:** accepted 2026-09-30, in the verified-review plan the human approved. It completes
[ADR-004](ADR-004-admission-and-receipts.md) point 8. **Built** at milestone 2a.6 (`evals/sdk/durable.md`): points 1 to 3;
the lock is on the record file. Point 5, snapshots, remains Alpha work.

## Context

- **Today's guard forgets.** Window reservations, sensor state and Keel's state live in memory
  (`packages/sdk/src/guard.ts`, defect D11 in `docs/SPEC.md`). A restart empties the caps, forgets in-flight intents
  and used receipts, and would un-latch a latched guard.
- **That is a documented failure.** On Solana, an agent sent about 5% of a token's supply after a session crash erased
  its wallet state (`docs/CLAIMS.md` M4).
- **Two guards on one key double the caps.** Nothing in Draft 1 stops a second process from guarding the same key.
- **Keel's restored state is not validated upstream** (finding U-3 in `kb/REGISTRY.md`).

## Decision

1. **Write before answering.** Every decision is appended to a hash-chained JSONL log and synced to disk before the
   guard returns it. The line carries the message bytes and where each input came from (ADR-009, point 1), so the
   log replays on its own.
2. **Restore by replay.** On start, the guard verifies the chain and replays it. That rebuilds window reservations,
   intents and their attempts, used receipts, the latch and Keel's state. Keel's state is only ever rebuilt by
   replay, never loaded from stored numbers.
3. **One writer per guard identity.** The identity is the policy hash, the principal and the log. The guard takes an
   exclusive lock on the log, and a second instance refuses to start.
4. **Caps are per identity; the fleet's bound is on-chain.** Off-chain caps bound one guard identity. The Squads
   spending limit (ADR-006) is the only bound across a fleet, and the documents say so.
5. **Snapshots, in the Alpha.** A signed state snapshot every N decisions bounds replay time. A snapshot is accepted
   only if replaying the log from it reproduces the head hash.

## Consequences

- New battery: kill the guard at random points and require the restored state to equal the state before
  (`docs/SPEC.md` §11).
- The dashboard reads the same log, so what it shows is what the guard will rebuild.
- An fsync per decision costs latency. It is measured, and the target is recorded in `docs/READINESS.md`.
- A deleted log starts a guard from nothing. The on-chain limit still bounds it; the threat model records this.

## Would show this was wrong

- Replay time at realistic log sizes breaks the restart target before snapshots exist.
- Replay diverges across supported Node versions, for example through canonical-JSON or hashing differences.
