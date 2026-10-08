# Private SDK preview — concrete consumer path

2026-10-08 · builder/integrator local Linux, Node 26.7.0 · base 5b00257 plus
candidate. Proposed devnet evaluation scope, not a stable or public release.

`docs/release/STAGED-RELEASE.md` records go/no-go conditions and human decisions.
`docs/PRODUCT-PAGE.md` supplies claim-traced private page copy. The actual compiled
private SDK is packed as `solanaut-sdk-0.0.0.tgz` under
`.sandbox/solanaut-1/staged-preview/`; its digest and all shipped-file/source
identities are recorded in `staged-preview/candidate.json`. Version and private
metadata are unchanged. The receipt's commit identifies the tested source;
generated tarball bytes are not published or checked into source history.

The installed consumer initially fails because the companion example is absent.
The new pure JavaScript example uses only documented SDK exports and synthetic
public bytes. Admission, single-use redemption, unknown bookkeeping, named denial
and replay run without keys, signing, RPC or sending. The consumer copies the
actual example outside the workspace so module resolution uses installed
JavaScript. Its exact output is asserted by the existing installed battery.

The guide gives the complete private tarball installation and execution path,
policy/ephemeral-state locations, prerequisites, trust conditions and remedies.
Installation may use npm for the pinned runtime dependency; the example itself
is offline. Existing offline consumer qualification uses cached metadata. Neither
is a clean reference-machine, dedicated signer or human-usability study.

Regenerate: `npm run release:prepare`; `npm pack ./.sandbox/releases/sdk --pack-destination .sandbox/solanaut-1/staged-preview --json`;
`node --test evals/packaging/packed-sdk.test.ts`; `node evals/packaging/faults.ts`.
Follow `docs/PREVIEW.md` to run the actual artefact. The tarball is reviewable
private build output; it is not an accepted preview version or release freeze.

Final installed/fault output and candidate manifest accompany this receipt.
Current source integration has passing local ordinary/type/AST and unchanged
floors, in `../sdk/request-index-integration.md`. Full exact-revision hosted
qualification remains required; preceding 5b00257 fails its unchanged baseline
wait. Independent Alpha, Linux operations, audit/bounty, source history/licence
and public supply-chain/publication gates remain open. Staging does not waive them.
