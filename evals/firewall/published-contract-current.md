# PHX-3/4 — current published MCP pair inspection

2026-10-08 in Toronto; exact UTC observation is retained. Codex builder-side
static research, not independent security or executable compatibility evidence.
This follow-up preserves the earlier MCP `1.2.8` / CLI `2.0.1` evidence unchanged.

Inspect exact `@phantom/mcp-server@1.2.9` and `@phantom/cli@3.0.0` archives.
The MCP manifest declares CLI `^3.0.0`; selecting the exact lower-bound CLI here
does not establish what an installation resolves. Registry metadata, matching
SHA-512/SHA-1 integrity, download SHA-256, source hashes and short numbered route
excerpts are retained in `published-contract/current-pair/`. Registry signature
and provenance verification were not performed.

The wrapper still starts CLI MCP mode. The send action source is byte-identical
to inspected CLI `2.0.1`: it awaits `client.signAndSendTransaction`, then returns
signature, network and account. The Solana transfer subsection is also
byte-identical: each invocation constructs the transaction, and `rawTransaction`
is returned after the awaited sign-and-send call. The complete transfer source
differs, including its EVM network handling; no complete-source equivalence is
claimed. Both current schemas still lack a signed-byte interception parameter.
Their helper handler takes parameters and context, then invokes the action.
Compiled entry bytes contain the corresponding send and raw-result patterns;
this static presence check is not an execution test.

Neither inspected MCP action route supplies pre-broadcast signed-byte validation.
A compatible signing/interception seam remains unresolved before forwarding can
meet the accepted wallet-revalidation requirement. This finding does not rule
out a separately designed SDK integration, future upstream capability, or establish
that Phantom mutates any transaction. The earlier current-docs observation stays
separate from these exact package schemas.

Primary archives:
[MCP 1.2.9](https://registry.npmjs.org/@phantom/mcp-server/-/mcp-server-1.2.9.tgz),
[CLI 3.0.0](https://registry.npmjs.org/@phantom/cli/-/cli-3.0.0.tgz).
Regenerate using `published-contract/current-pair/commands.md`. Static artifact
consistency output is retained as `verification.txt` in that directory.

No dependency installation, resolved graph, module import/execution, authentication,
session/key access, RPC, signing or send. Tarballs/full source stay in ignored
scratch. No product/gate change, milestone credit, remote-wallet guarantee,
independent security or stable-release qualification follows.
