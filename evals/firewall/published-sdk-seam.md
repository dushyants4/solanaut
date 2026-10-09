# PHX-3/4 — low-level Phantom signing seam

2026-10-08 in Toronto; exact UTC observation is retained. Codex builder-side
static research, not independent security, live support or nonbroadcast evidence.
Earlier MCP route observations are preserved unchanged.

Exact CLI `3.0.0` declares `@phantom/client ^2.0.4`; inspect client `2.0.4`
explicitly, not a resolved installation. The CLI's SSO and device-flow client
constructors both select `walletType: "user-wallet"`. No actual session is read.
Separately inspect browser SDK and embedded-provider-core `2.0.4` for support
context. Metadata, matching archive integrity, download/source hashes and short
numbered excerpts are retained in `published-contract/sdk-seam/`.

The client's public API exposes `signTransaction` returning `rawTransaction`, and
a per-call `presignTransaction` callback. Its compiled sign-only method selects
shared signing with submission disabled. The KMS sign request omits
`submissionConfig`, with `X-Rpc-Method` set to `signTransaction`. However, the
preceding user-wallet `/prepare` request still receives network-derived submission
configuration with that method header. Static request construction does not prove
remote service authorisation or absence of broadcast.

The presign callback runs after wallet preparation and before the KMS signature,
only when the prepared value is a string. It can inspect prepared transaction
bytes; it is not an interception of the final wallet-signed wire. In the combined
sign-and-send path, returned signed bytes arrive after the submission-enabled KMS
request. Stock inspected MCP actions expose neither callback nor sign-only mode.

Current [Browser SDK documentation](https://docs.phantom.com/sdks/browser-sdk/sign-and-send-transaction)
explicitly withholds `signTransaction` and `signAllTransactions` support for
embedded wallets. It documents the presign callback before the embedded wallet
signs. The exact embedded-provider-core implementation nevertheless delegates its
sign-only method to `client.signTransaction`, then parses the returned raw wire;
it does not call the combined sending method there. Code availability and the
current documented support restriction are distinct facts. Neither establishes
what an intended CLI agent wallet is authorised to do on the live service.

A low-level sign-only API therefore exists, but a supported, live nonbroadcast
integration meeting accepted final-byte revalidation remains unestablished.
Do not describe Phantom as having no sign-only API, reinterpret a presign callback
as post-sign interception, or build a new deployment contract on this observation.
Any supported alternative needs its design and actual nonbroadcast qualification.

Primary archives:
[client 2.0.4](https://registry.npmjs.org/@phantom/client/-/client-2.0.4.tgz),
[browser SDK 2.0.4](https://registry.npmjs.org/@phantom/browser-sdk/-/browser-sdk-2.0.4.tgz),
[embedded provider 2.0.4](https://registry.npmjs.org/@phantom/embedded-provider-core/-/embedded-provider-core-2.0.4.tgz).
`sdk-seam/commands.md` regenerates the static observations; `verification.txt`
records artifact consistency. Registry signature/provenance verification is not
performed. Tarballs and full source/documentation remain in ignored scratch.

No dependencies installed or resolved, module imported/executed, key/session or
authentication accessed, RPC, signing or send. No interception integration,
isolation, remote-wallet guarantee, ADR change, milestone or stable-release credit.
