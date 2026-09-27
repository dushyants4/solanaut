---
type: source
status: current
url: "https://thehackernews.com/2024/12/researchers-uncover-backdoor-in-solanas.html"
title: "Researchers Uncover Backdoor in Solana's Popular Web3.js npm Library"
publisher: "The Hacker News"
published: "2024-12-04"
fetched: 2026-09-27
checked: first-hand
created: 2026-09-27
updated: 2026-09-27
---

# The @solana/web3.js 1.95.6 and 1.95.7 backdoor

A supply-chain attack on the library Solanaut itself depends on, and the reason the key must live
outside the agent's process.

## Key facts

- **Versions:** 1.95.6 and 1.95.7, available for about five hours on 2024-12-02 (15:20–20:25 UTC).
- **Payload:** it was "designed to steal private keys". It "exfiltrates the private key through
  seemingly-legitimate CloudFlare headers".
- **Who was hit:** "projects that directly handle private keys"; non-custodial wallets generally
  were not.
- **Stolen:** 674.86 SOL ($164,100).
- **The way in:** a maintainer with publish access was phished.

## What it supports

- `docs/CLAIMS.md` M6
- [kb/wiki/defai/incidents.md](../wiki/defai/incidents.md)
- [kb/wiki/security/_index.md](../wiki/security/_index.md): key custody.
- Solanaut pins web3.js at 1.99.0 (`kb/REGISTRY.md`). Pinning plus the lockfile is the defence
  against a bad release reaching an install.

## Caveats

- Not an AI-agent incident. It hit any code that held a key in-process, which is exactly how most
  agents hold theirs.
