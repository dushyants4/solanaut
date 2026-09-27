---
type: source
status: current
url: "https://arxiv.org/abs/2503.16248"
title: "Real AI Agents with Fake Memories: Fatal Context Manipulation Attacks on Web3 Agents"
publisher: "arXiv"
published: "2025-03-20 (v1); 2025-07-09 (v3)"
fetched: 2026-09-27
checked: first-hand
created: 2026-09-27
updated: 2026-09-27
---

# Real AI Agents with Fake Memories

Peer research showing that an agent's stored context can be poisoned to move funds, and that
prompt-level defences do not hold once it is.

## Key facts

- **The framework:** ElizaOS, "a representative decentralized AI agent framework for automated Web3
  operations".
- **The attack:** "context manipulation", with "memory injection" as "a more stealthy and persistent
  threat" than prompt injection.
- **The effect:** "malicious injections into prompts or historical records can trigger unauthorized
  asset transfers and protocol violations."
- **Defences:** "prompt-injection defenses and detectors only provide limited protection when stored
  context is corrupted". Fine-tuning-based defences "substantially reduce attack success rates".

## What it supports

- `docs/CLAIMS.md` M3
- [kb/wiki/defai/incidents.md](../wiki/defai/incidents.md)
- [kb/wiki/security/_index.md](../wiki/security/_index.md)

## Caveats

- These are research attacks, not a documented loss.
- The fine-tuning result is theirs. Solanaut does not fine-tune models and claims nothing about it.
