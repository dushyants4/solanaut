# Published ElizaOS route experiment — unqualified integration graph

2026-10-08; Linux/Node 26.7.0; builder-authored local experiment for ELZ-1/2/3
under ADR-017. Fixtures, exact lockfile, outputs and checksum inventories are in
`published-routes/`. No production dependency or root lockfile changed.

The sandbox resolves published plugin-solana 1.2.6, core 1.7.2 and
service-interfaces 1.7.2 through normal npm resolution with scripts disabled.
The actual AgentRuntime receives explicit empty settings, a public-only character
and no exchange providers. Model/cache/RPC/Jupiter boundaries are fixtures, and
native network/signing/key-construction/key-generation/send counters are asserted.
Actual plugin initialisation registers its published actions and service classes.

Five routes reach their actual missing-key boundary: SOL and SPL transfer actions,
swap action after quote/swap-byte retrieval, wallet-service transfer after the
fixture blockhash read, and trading-service executeSwap after sufficient fixture
balance and quote retrieval. All signing, sends, secret-key construction, generated
keys and native network counters remain zero. This proves these concrete routes
under this configuration; it does not prove all future plugins, registrations,
external-wallet inputs or runtime configurations safe. createWallet is not invoked
or exposed. External-wallet private keys must also be excluded by an integration.

Initial repository-graph Zod import incompatibility and the first probe's
import-only package resolution error are retained. The final isolated graph/probe
passes. Installed plugin/core/service JavaScript bytes match independently fetched
registry tarballs with verified integrity. Signature verification reports 202
verified registry signatures and 19 verified attestations; these are package
observations, not Solanaut release provenance qualification.

The proposed newer alpha, plugin-solana 2.0.0-alpha.6, generates and stores a key
when absent in its published source. That static finding contradicts ADR-017's
historical version assumption; it was not executed. Stable-version selection is
within the accepted ADR, but no Solanaut plugin is implemented by this experiment.

The resolved experiment graph has 18 npm-audit findings: six low, six moderate,
four high and two critical. form-data 4.0.6 fixes the retained advisories but
conflicts with the plugin's exact 4.0.2 peer; the normal fixed-peer experiment
fails ERESOLVE. No force, overrides or legacy-peer resolution is used. bigint-buffer
1.1.5 has no published patch; disabled scripts/pure-JS fallback do not grant a
general reachability waiver. pdfjs-dist 6.2.108 fixes its advisory outside core's
declared range. The upstream graph remains unqualified for release.

A separate read-only root workspace audit reports 19 findings: three low, nine
moderate, seven high and zero critical. That workspace graph includes framework
evaluation dependencies and must not be presented as the packed SDK runtime graph.
No automatic audit fix or threshold exception was applied.

To reproduce, copy the retained package.json, package-lock.json and routes.mjs
into a fresh project-local sandbox, run `npm ci --ignore-scripts --no-fund`, then:

```sh
env -i PATH="$PATH" HOME="$HOME" NODE_ENV=test LOG_LEVEL=error SOL_ADDRESS=So11111111111111111111111111111111111111112 node routes.mjs
npm audit --json
npm audit signatures
```

The probe writes route-results.json beside itself: never regenerate over retained
tracked evidence. Verify both checksum inventories from the retained directory.
This is no ELZ milestone closure, outside-user study, independent security campaign,
installed Solanaut integration, network rehearsal, supported graph or stable release.

Primary sources: [published plugin metadata](https://registry.npmjs.org/@elizaos%2fplugin-solana/1.2.6),
[core metadata](https://registry.npmjs.org/@elizaos%2fcore/1.7.2),
[form-data critical advisory](https://github.com/advisories/GHSA-fjxv-7rqg-78g4),
[form-data high advisory](https://github.com/advisories/GHSA-hmw2-7cc7-3qxx),
[bigint-buffer advisory](https://github.com/advisories/GHSA-3gc7-fjrx-p6mg),
[pdfjs advisory](https://github.com/advisories/GHSA-hq66-cqwq-w95j).
