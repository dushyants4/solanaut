---
type: source
status: current
url: "https://registry.npmjs.org/@phantom/mcp-server/-/mcp-server-1.2.9.tgz"
title: "Phantom published MCP and CLI signing routes"
publisher: "Phantom, through the public npm registry"
published: "package versions retained in registry metadata"
fetched: 2026-10-08
checked: first-hand
created: 2026-10-08
updated: 2026-10-08
---

# Published MCP routes return after signing and sending

Static inspection of exact public archives, checked in Toronto on the date above;
UTC capture times, registry metadata and byte hashes are retained in the receipts.
No module was installed or executed.

## Facts

- MCP `1.2.8` delegates to CLI `^2.0.1`; MCP `1.2.9` delegates to CLI `^3.0.0`.
  An MCP version alone does not freeze the implementation it resolves.
- Exact CLI `2.0.1` and `3.0.0` send routes await `signAndSendTransaction` before
  returning a signature, network and account. The inspected Solana transfer routes
  also call that method; `rawTransaction` is returned afterwards.
- Neither inspected MCP action route exposes a pre-broadcast signed-byte
  interception parameter.
- CLI `3.0.0` declares client `^2.0.4` and constructs a `user-wallet` client.
  Exact client `2.0.4` exposes a sign-only raw-wire result. Its KMS signing request
  omits submission configuration, but its preceding preparation request includes
  network-derived submission configuration. Static construction is not proof of
  live service permission or absence of broadcast.
- The client's presign callback runs after preparation and before the remote
  signature. It cannot inspect the final signed wire in the combined sending path.
  [Current Browser SDK documentation](https://docs.phantom.com/sdks/browser-sdk/sign-and-send-transaction)
  withholds sign-only support for embedded wallets; that support statement does
  not establish the exact CLI wallet's service permissions.
- Both inspected tool schemas allow wallet and derivation overrides and boolean
  coercion for confirmation. Transfer accepts strings or numbers for amount and
  coerces decimals. These are upstream parsing semantics, not safe policy inputs.
- The [current official reference](https://docs.phantom.com/phantom-mcp-server/tools)
  documents a transfer RPC override absent from those exact inspected schemas.
  Keep current documentation and pinned implementation observations separate.

## Evidence and limits

The [earlier pair receipt](../../evals/firewall/published-contract.md) and
[current pair receipt](../../evals/firewall/published-contract-current.md) retain
archive/member hashes, registry-integrity agreement, short numbered excerpts and
regenerating commands. Primary CLI archives are
[2.0.1](https://registry.npmjs.org/@phantom/cli/-/cli-2.0.1.tgz) and
[3.0.0](https://registry.npmjs.org/@phantom/cli/-/cli-3.0.0.tgz).
The separate [SDK seam receipt](../../evals/firewall/published-sdk-seam.md) retains
exact client, browser SDK and embedded-provider-core observations. Selected
lower-bound versions are not an installed dependency graph.

Registry-byte agreement is not independent origin signature/provenance verification.
No resolved dependency graph, live compatibility, remote-wallet mutation behaviour,
session/key protection or security qualification was established. This does not
change ADR-011's requirement to validate wallet-returned bytes before sending.
