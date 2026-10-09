# PHX-3/4 — published Phantom contract inspection

2026-10-08; Codex builder-side research, not independent security evidence.
Static inspection only, based at Solanaut `0332c977eb0dadec8a5592324fb8ad1f76ab2db0`.
Accepted ADR-011 supplies the intended integration contract; this inspection does
not qualify the component or change an accepted decision.

`published-contract/` retains exact public npm metadata, archive/source hashes,
short selected route excerpts and separately labelled current documentation
observations. Downloads match their registry SHA-512 integrity and SHA-1 values.
Registry signature/provenance verification was not performed; agreement with
registry metadata is not independent origin authentication. Tarballs and full
third-party source/documentation remain only in ignored scratch.

The inspected `@phantom/mcp-server@1.2.8` wraps `@phantom/cli ^2.0.1`.
Consequently, the MCP package version alone does not freeze its tool code. Inspect
CLI `2.0.1` explicitly here, rather than inferring a resolved dependency graph.
The separate current-registry observation records MCP `1.2.9` depending on CLI
`^3.0.0`; that route was not inspected or qualified.

Both inspected tools accept boolean or string-boolean `confirmed` input. Transfer
amount accepts strings or numbers, and token decimals use numeric coercion.
The transfer schema does not include `rpcUrl`; the current
[official tool reference](https://docs.phantom.com/phantom-mcp-server/tools)
documents that field. Current documentation is not the exact inspected schema.
Wallet/derivation overrides exist in both sources and need binding to the guarded
principal before forwarding. Prefer deliberately narrow argument normalisation,
not upstream coercions as policy semantics.

The send route awaits `client.signAndSendTransaction`, then returns only a
signature, network and account. The Solana transfer route rebuilds inside each
invocation and returns `rawTransaction` after the same sign-and-send call.
Neither inspected route exposes pre-broadcast signed-byte interception.
This is a static route observation, not evidence that Phantom alters the bytes.
The accepted requirement to revalidate wallet additions before sending therefore
needs a compatible seam established before forwarding implementation; simulation
and returned post-send bytes cannot supply that seam. No dependent forwarding is
built on an assumed capability.

Primary archives:
[MCP 1.2.8](https://registry.npmjs.org/@phantom/mcp-server/-/mcp-server-1.2.8.tgz),
[CLI 2.0.1](https://registry.npmjs.org/@phantom/cli/-/cli-2.0.1.tgz).
Regenerating commands are in `published-contract/commands.md`; exact byte hashes,
member paths and line observations are in `published-contract/observations.json`.
Current documentation retrieval has its own URL, date and byte hash in
`published-contract/docs-observations.json`.

All metadata queries, downloads, archive reads and integrity comparisons completed.
No dependency installed, third-party module imported/executed, authentication or
session read, key access, RPC, signing or send. No independent audit, live
compatibility, maintained gate, milestone or stable-release credit follows.
