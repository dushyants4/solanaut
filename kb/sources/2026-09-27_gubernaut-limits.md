---
type: source
status: current
url: "https://github.com/thegubernaut/gubernaut/blob/main/docs/LIMITS.md"
title: "docs/LIMITS.md — what Gubernaut does not do"
publisher: "Gubernaut (github.com/thegubernaut)"
published: "undated; main at 4f186fa, 2026-09-27"
fetched: 2026-09-27
checked: first-hand
created: 2026-09-27
updated: 2026-09-27
---

# Gubernaut's published limits

Gubernaut's own statement of its limits. It is the document that makes every Gubernaut figure quotable
only with its scope.

## Key facts

Lines are from the raw file on `main`.

- **Injection (l.19, l.24):**
  - Gubernaut "is **not injection-proof**."
  - "There is no jailbreak success-rate figure in this project, because none was measured."
- **Sensor (l.39–41):**
  - "Calmly worded, non-lexicon hostility | **5/5 missed** on that corpus"
  - "False sever on benign traffic | 0/30"
  - "Calm loops caught by the repetition veto | 10/10"
- **Latency (l.61):** "**~125 ns per tick**, 200 ns p99 | The wasm core on an edge runtime. The
  workerd figure is external-throughput-derived".
- **Savings (l.75–82):**
  - "the governed arm pays 4.1% to 20.2% of the ungoverned bill across" seven measured
    configurations in four model families.
  - "That is a ceiling on a specific pathology. It is not a general claim about your bill."
  - On "an agent that never loops it saves nothing".
- **Configuration (l.133):** the validation "record used a held-out evaluated configuration". The
  shipped constants are working defaults, and its original run "does not reproduce from these
  defaults".

## What it supports

- `docs/CLAIMS.md` §2 (G1–G6) and §3 (the rejected drop claims).
- [kb/wiki/gubernaut/_index.md](../wiki/gubernaut/_index.md)

## Caveats

- The savings figures are **LLM API spend** through the Tiller proxy, on a verbatim-loop battery.
  They say nothing about Solana fees.
- The 5/5 figure is about Tiller's v0 text sensor. Keel ships no text sensor, and Solanaut's sensor
  reads transactions, not text.
