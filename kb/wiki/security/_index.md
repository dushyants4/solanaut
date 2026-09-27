---
type: topic
status: current
created: 2026-09-27
updated: 2026-09-27
---

# Agent-wallet security

**Sources:**
- [NIST: reference monitor](../../sources/2026-09-27_nist-reference-monitor.md)
- [Saltzer and Schroeder](../../sources/2026-09-27_saltzer-schroeder-1975.md)
- [Fake Memories](../../sources/2026-09-27_arxiv-fake-memories.md)
- [the web3.js backdoor](../../sources/2026-09-27_thehackernews-web3js-backdoor.md)
- [ClawHavoc](../../sources/2026-09-27_thehackernews-clawhavoc.md)

An AI agent that holds a key turns model mistakes into lost funds. The security question is not "can
the model be fooled?" (it can) but "what can a fooled model, a confused model, or a stolen key still
do?"

## Key takeaways

- **Defences inside the model are weak** once its context is poisoned: prompt-injection defences
  "only provide limited protection when stored context is corrupted".
- **The classic answer is a reference monitor**, "always invoked… tamperproof, and small enough to be
  subject to analysis and tests". Solanaut aims to be one for the agent's signatures.
- **Keys held in the agent's process** are exposed to its dependencies and plug-ins (the web3.js
  backdoor, ClawHavoc). A monitor in the same process as a compromised agent can be bypassed.

## Details

- [The admission pattern](admission-pattern.md): how Solanaut decides, receipts, intents, the log.
- [Incidents](../defai/incidents.md), by cause.
- The full threat model is `docs/papers/THREAT-MODEL.md`.

## For Solanaut

Three layers, each for what it can actually do:

1. **An SDK guard in the agent's process.** Policy and loop control, against a fooled or confused
   model.
2. **A signer process that holds the key** (P1). It keeps the monitor tamper-proof from the agent.
3. **On-chain limits** (Squads). They bound a stolen key.

## Related

- [DeFAI on Solana](../defai/_index.md)
- [competitors](../competitors/_index.md)

## Open questions

- Can the signer process be small enough to audit in a week? The target is under 500 lines, stated
  and then measured.
