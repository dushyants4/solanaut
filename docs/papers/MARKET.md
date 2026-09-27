# MARKET.md — the market Solanaut enters

> **Draft 1** · 2026-09-27 · owner: archivist (research) · for: the human and judges · not public.
> Facts cite `kb/sources/` notes with the date checked. A fact marked *(via-agent)* was read only by a
> research agent. Statements about other products are what their public documents said on 2026-09-27,
> not claims about how those products behave. Register: `kb/DOCUMENTS.md`.

## Summary

- **Agents with wallets are real on Solana,** and they have lost money in documented ways
  ([incidents](../../kb/wiki/defai/incidents.md)).
- **Caps and allowlists are already sold** by signing services and enforced by on-chain programs.
- **The research found no product documenting control of retries, fee escalation or double-sends
  after expiry.** That is Solanaut's opening, not a claim that nobody does it (`docs/CLAIMS.md` §1).
- **The honest risks:** the AI category is crowded, and real agent payment volume is small.

## 1. Who builds agents on Solana, and how

- **Frameworks.**
  - Solana Agent Kit 2.0.10, ElizaOS's `plugin-solana` 1.2.6 and Anchor's TS client all build on
    `@solana/web3.js` 1.x. `@solana/kit` 8.3.0 is the modern line
    ([npm, 2026-09-27](../../kb/sources/2026-09-27_npm-agent-frameworks.md)).
  - Monthly downloads: about 9M for `@solana/kit`, 42.7k for `@elizaos/core`, 33.4k for
    `@coinbase/agentkit` and 4.3k for Solana Agent Kit, which drew 41.3k in January 2025
    ([landscape](../../kb/sources/2026-09-27_agent-landscape-via-agent.md), via-agent).
- **Payments are the fastest-moving story, and the least settled.** x402 transaction counts on Solana
  are large, but estimates of genuine agent volume differ by about 20× (via-agent). Solanaut does not
  cite them.
- **Colosseum's own record.**
  - AI platforms and agents were the largest category at Frontier, with 493 of 2,857 submissions
    (via-agent).
  - Recent AI and infrastructure winners sold payment rails or developer tools with a clear buyer.
  - One security-only winner, Sudont, won a prize but not an accelerator place (via-agent).

## 2. The losses, and what they have in common

| Cause | Cases | Controls that bound it |
|---|---|---|
| Authority held by the model | Freysa [M1], AIXBT [M2], Grok and Bankr [M5] | a policy outside the model |
| Lost state | Lobstar Wilde, on Solana [M4] | per-mint caps |
| Keys in the agent's process | the web3.js backdoor [M6], ClawHavoc [M7] | a separate signer; on-chain limits |
| Retries and expiry (risk, not incident) | bots fail 58.43% of the time on Solana; 17.72% of failures expire [M8] | loop control; intents |

## 3. Who already sells what

| Layer | Products | Documented | Not documented |
|---|---|---|---|
| Signing service | Privy (Stripe) ([docs](../../kb/sources/2026-09-27_privy-solana-policies.md)), Turnkey ([blog](../../kb/sources/2026-09-27_turnkey-solana-policy-engine.md)), Coinbase CDP (via-agent), Phantom's MCP wallets (via-agent) | per-transaction Solana rules: programs, amounts, mints, recipients | Privy: lookup-table addresses, and Solana window totals ([stateful](../../kb/sources/2026-09-27_privy-stateful-policies.md)); retry or fee control anywhere |
| On-chain program | Squads v4 ([docs](../../kb/sources/2026-09-27_squads-spending-limit.md)), Swig ([repo](../../kb/sources/2026-09-27_swig-wallet.md)), the Foundation's allowances ([docs](../../kb/sources/2026-09-27_solana-recurring-delegation.md)) | per-period caps; destinations (Squads) | anything about the transaction stream |
| Simulation and scanning | Sudont, Blockaid, Blowfish (via-agent) | risk verdicts; structured errors for agents | enforcement of budgets |
| Agent's own process | Sol CLI, AgentVeins and other small guards (via-agent) | caps, allowlists, some loop rules | adoption; key isolation (Sol CLI's docs say so) |

## 4. Where Solanaut fits

**Inference.** Solanaut is not a wallet and not a custodian. It sits in front of whatever wallet the
agent uses, and composes with the on-chain programs rather than competing with them. It adds three
things the documentation read so far does not describe together:

1. **Control of the transaction stream:** loops, fee escalation, and double-sends after expiry, through
   Keel and intents.
2. **Caps done carefully:** reserved at admission, and aware of lookup tables and tokens (ADR-004,
   ADR-005).
3. **One policy, enforced twice:** in the SDK before signing, and bounded on-chain by Squads (ADR-006).

## 5. Risks to the opportunity

- **Platform risk.** Stripe (Privy), Coinbase and Turnkey could add loop control to policies they
  already sell. Solanaut's answer is to be open source and to compose with them.
- **A small market today.** Genuine agent payment volume is contested and possibly small; the losses
  are concentrated in trading agents.
- **A crowded category.** AI is Colosseum's largest category; the pitch has to lead with the evidence,
  not with "AI".
- **A risk without an incident.** Loops are a risk the data suggests, not a documented agent loss.

## 6. What would change this

- Colosseum Copilot, run by the human against Sudont, AgentVeins and BlockHelix, finds a team already
  building this.
- A wallet provider documents retry or fee control.

## Changes

| Version | Date | What changed |
|---|---|---|
| Draft 1 | 2026-09-27 | First draft. |
