# RT-1 / RT-3 — frozen synthetic traffic definition

Definition 1, fixed before measurement on 2026-10-06. Builder-authored SDK evidence;
no chain execution, isolated signer or independent red team. Requirements: SPEC RT-1/RT-3,
READINESS benign traffic and loop rows. No sensor coefficient or policy rule changes.

Five independent fresh guards each receive 500 legacy SOL proposals. Seeds 2606101 through
2606105 bind steady, jitter, bursts, variable-fees and recurring respectively. Policy expects
six proposals per minute, permits three destinations, and leaves its spending/fee windows
above the workload. Allowed proposals receive an immediate synthetic landed outcome.

- Steady: ten-second gaps, varied small amounts and destinations.
- Jitter: uniformly sampled eight- to twelve-second gaps, varied small amounts/destinations.
- Bursts: ten proposals 100 ms apart, each batch beginning 100 seconds after the last.
- Variable fees: ten-second gaps, priority price sampled from 5,000–20,000 micro-lamports,
  explicit 200,000-unit limit, varied small amounts and destinations.
- Recurring: ten-second gaps, the same destination and amount after each landed outcome.

Amounts outside recurring are uniformly sampled from 1,000,000–10,000,000 lamports.
Recurring sends 5,000,000 lamports. Blockhash bytes vary deterministically; this never turns
an unresolved intent into a distinct payment. No automatic latch release. Every refusal,
including subsequent latched refusals, counts in the primary false-stop denominator.
Keep the unrounded Wilson upper endpoint with z=1.96, the existing battery's two-sided
95% interval; its upper endpoint must be at most the existing 2% target. Retain per-profile
counts and named rules alongside the aggregate. No selection by outcome or silent skips.

Separately report four loop streams: identical, fee-escalating, alternating two shapes and
distinct payments with failed outcomes. Each offers at most 60 proposals, 400 ms apart;
allowed proposals are synthetically reported failed. Record the first refusal turn and
named rule, or explicitly report no refusal within the defined horizon. This is an admission
refusal, not a claim of on-chain execution, guaranteed loop detection or drained funds.
Do not impose a new stop-turn threshold or tune against these results. A definition change
requires fresh seeds and preserves this definition and its failures.

Loops use 250,000,000 lamports for identical and fee-escalating payments to destination 2.
Escalating price is 1,000 times the turn in micro-lamports with a 200,000-unit limit.
Alternating sends 250,000,000 plus the turn to destinations 2 and 3 alternately.
Failed-outcome distinct payments use 1,000,000 plus the turn, cycling destinations 2–4.
Loop blockhash seeds are 2606201–2606204; no loop result has been observed when these
definitions are written. The common policy allows at most one SOL per transaction, 1,000
SOL per day, priority fee 10,000,000 lamports, fee window 1,000 SOL, three attempts per
intent and five consecutive denials before latching. No token, opaque, message or co-sign
permission. The pinned published Keel and actual sensor v1 are used, without injected telemetry.
