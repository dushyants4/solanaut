# ADR-015 · When the record's head is anchored on-chain, and who pays

**Status:** **accepted** by the human on 2026-10-05, with the Alpha's scope (milestone 2c.1); proposed on 2026-10-01. It answers ANC-5 in
[docs/SPEC.md](../docs/SPEC.md) §13.7, and is written before milestone 3.7's code.

## Context

- **The threat.** T12: the record rewritten. The hash chain catches an edit in the middle, but not a wholesale rewrite,
  which recomputes every hash. SPEC §9 fixes the program: `solanaut_anchor`, one instruction,
  `anchor(head: [u8; 32], seq: u64)`, writing the head to one PDA per guard and emitting `DecisionAnchored`.
- **What is open.** How often to anchor, on what events, and which key pays, given that every lamport the principal
  spends counts against the policy's caps.
- **The trade.** Anything after the last anchor can be rewritten undetected, so the interval is the exposure. Each
  anchor is a transaction: 5,000 lamports in base fee, and one signature.

## Options

| | Cadence | Exposure | Transactions a day |
|---|---|---|---|
| A | every entry | none | one per decision: unbounded, and it doubles the RPC load |
| B | every N entries | up to N entries | depends on traffic; none when idle |
| C | at most once a minute while entries are new, and at once after a latch, a release or a policy entry | at most a minute of entries; never a latch or a release | at most 1,440 (about 0.0072 SOL a day in base fees) |

**Who pays:**

| | Payer | Problem |
|---|---|---|
| 1 | the agent's key | counts against the caps, and a stolen agent key could then anchor a forged head |
| 2 | a dedicated anchor key, held by the signer, funded by the operator | one more key to fund |

## Decision (accepted 2026-10-05)

**C with 2.**

1. **Cadence.**
   - The signer anchors at most once every 60 s, and only when there are entries since the last anchor.
   - It anchors at once after any entry that changes what the guard will admit: a latch, a release, or a `policy` entry
     (ADR-014).
2. **The payer and authority.**
   - A dedicated anchor key, held by the signer under its own user (ADR-013), is both the fee payer and the anchor
     authority. It is outside the principal.
   - The operator funds it. It may sign only `solanaut_anchor` transactions, and the signer refuses to use it for
     anything else.
3. **The PDA.** Seeds: `"anchor"` and the SHA-256 of `latch.guardId`. One per guard identity.
4. **The check.**
   - `replay` and restore, given an RPC, read the PDA, and require the entry at the anchored `seq` to hash to the
     anchored head.
   - A mismatch refuses to start, like any other damage to the record (SPEC §7).
5. **A failed anchor is not a failed decision.** Anchoring retries with backoff. A gap longer than ten minutes is shown
   on the dashboard and recorded, because it widens the exposure.

## Consequences

- **What it stops.** A rewrite of anything older than the last anchor, and any rewrite that crosses a latch or a
  release. T12's residual narrows to "at most a minute of entries".
- **Cost.** At most 1,440 transactions a day per guard, about 0.0072 SOL in base fees. None while the guard is idle.
- **Operations.** The anchor key needs a small float. Its balance belongs on the dashboard (3.8).
- **Not decided here:**
  - anchoring several guards' heads in one transaction;
  - a compressed history of heads. One PDA holds only the latest, and the `DecisionAnchored` events are the history.
