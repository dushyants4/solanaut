---
type: source
status: current
url: "https://pashpashpash.substack.com/p/my-lobster-lost-450000-this-weekend"
title: "My lobster lost $450,000 this weekend"
publisher: "the agent owner's Substack"
published: "2026-02-23"
fetched: 2026-09-27
checked: first-hand
created: 2026-09-27
updated: 2026-09-27
---

# Lobstar Wilde: a Solana agent that lost its wallet state

The owner's own account of a Solana agent incident. It is the most relevant documented loss for
Solanaut, because it happened on Solana and was not an attack.

## Key facts

- **The agent:** "Lobstar Wilde", built on OpenClaw, trading on Solana.
- **What was sent:** about 52 million tokens, roughly 5% of a meme coin's supply. The owner valued it
  at about $450,000; the intended spend was about 4 SOL (~$320).
- **The cause, per the owner:** a session crashed without flushing memory, and the rebuilt agent
  lost track of its wallet state. "The pre-existing allocation was invisible to him because the
  memory of having it existed in a session he could no longer load."
- **It was not an attack:** no exploit and no prompt injection.

## What it supports

- `docs/CLAIMS.md` M4
- [kb/wiki/defai/incidents.md](../wiki/defai/incidents.md)

## Caveats

- **The value is the owner's.** Other reports put it at ~$250k (Solana Compass, 2026-02-25) or
  $441,780 (Cointelegraph), per a research agent. Quote the token share, not a dollar figure.
- **The lesson is scoped:** a per-transaction cap on that mint bounds a send like this.
