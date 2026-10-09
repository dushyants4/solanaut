---
type: brief
status: draft
question: "Can the published Phantom MCP routes support wallet-byte validation before broadcast?"
created: 2026-10-08
updated: 2026-10-08
---

# Phantom's pre-send validation seam

**Question:** can the published route meet the accepted wallet revalidation contract?
**Asked by:** builder/integrator for Solanaut 1.0. **Method:** public exact-package
metadata, static archive/source inspection and separately labelled official docs.

## Answer

The inspected MCP send/transfer action routes return after signing and broadcast;
they cannot provide the required pre-send signed-byte interception. A low-level
client sign-only API exists, but its support and live nonbroadcast behaviour for
the intended agent wallet remain unqualified. Its presign callback runs before
the signature, so it does not supply final signed-wire interception. Never infer
the required contract from simulation or post-send transaction bytes.

## Evidence

| Finding | Source | Confidence |
|---|---|---|
| MCP wrappers delegate to ranged CLI dependencies | [published route source note](../sources/2026-10-08_phantom-published-routes.md) | exact inspected metadata |
| Exact older/current send and Solana transfer routes expose only post-send results | [static receipts](../../evals/firewall/published-contract-current.md) | exact inspected source ordering; not execution |
| Current documentation and inspected schemas differ | [source note](../sources/2026-10-08_phantom-published-routes.md) | separately captured primary observations |
| Low-level client exposes sign-only raw wire; embedded Browser SDK support is restricted | [SDK seam receipt](../../evals/firewall/published-sdk-seam.md) | static code and separately scoped official support statement; no live permission guarantee |

## Implications for Solanaut

Continue offline filtering and narrow argument/transaction preparation independently.
Before forwarding, establish the signing seam and bind wallet/derivation, network,
authoritative mint settings and account rent to policy. Any replacement that changes
an accepted architecture contract needs a proposed ADR and human acceptance first.
No wallet, server, dependency or gate change follows from this research. The
next qualification must distinguish the CLI's configured user-wallet from the
Browser SDK's embedded-wallet restrictions and prove final-byte validation before
any broadcast. Do not silently replace the accepted MCP deployment architecture.

## Not established

No published module execution, dependency graph qualification, authenticated
session, RPC, signature or send. The routes' behaviour does not establish whether
the remote wallet changes bytes. Independent security and human devnet rehearsals
remain owed. A differently designed SDK path may be possible and must be qualified.
