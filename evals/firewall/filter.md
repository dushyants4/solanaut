# PHX-3/4 — offline MCP tool and network selection

2026-10-08; builder/evaluator-authored local evidence, Linux/Node 26.7.0. Accepted
ADR-011 and HANDOFF item 9 authorise this offline component while signer/opaque
dependencies remain open. Base revision 588a1ef. Raw evidence: `filter/`.

`apps/firewall/src/filter.ts` accepts an explicit devnet-only operator configuration
and a serialized MCP tool-call parameter object. Only configured
`send_solana_transaction` and `transfer_tokens` calls are selectable; every other
tool, including message signing, refuses. Both tools require their own explicit
`networkId: "solana:devnet"`; omission is refused rather than rewritten. Selected
arguments are detached, deeply frozen data. Typed errors use fixed messages.

This selection is not a receipt or permission to forward. The component performs
no RPC, signing, transaction building, upstream call or send. Transaction decoding,
field/cap/rent validation, guard admission, wallet-returned-byte validation,
Phantom integration, policy-loading/authentication, server packaging and actual
cross-user deployment remain required. PHX-3/4/5 are not complete milestones.

Reversible internal conventions: configuration has exactly `cluster` and `tools`;
empty tools denies all; duplicates/unsupported names/accessors refuse. Calls have
exactly `name` and `arguments`, with object arguments. Input ceiling is 65,536 UTF-8
bytes and recursive value depth at most 32. These are parsing bounds, not security
or latency measurements. JSON data is parsed once; later layers must consume the
selected object, never forward the original text. JSON duplicate fields have
JSON.parse's last-value semantics in that detached object; there is no raw proxy.

All initial requirement cases fail with the absent implementation. An initial
parameter-property syntax fails native type stripping; replace it with an explicit
field without changing behaviour. Further first-reds expose accessor-based tool
substitution, inherited network defaults, post-validation proxy value substitution
and inherited property-descriptor values. Capture data descriptors once, require
their own value fields and validate the exact copied values used by selection.
Errors from hostile configuration traps are converted to fixed configuration errors.

The original eight-case component passes AST measurement at unchanged floors.
After proxy/descriptor follow-up, nine maintained cases pass and the original
fault trials remain. A screening fault initially misses because later value
validation still rejects a bare accessor; retain `faults-final.txt`. The inherited
descriptor regression exposes the relevant boundary and catches that screening
removal. Final thirteen product faults plus three firewall coverage faults are
caught, with all sources restored; no syntax, module error or timeout credit.

Coverage extends the existing SDK/signer instrumenter and inventories to the
firewall: aggregate statements at least 95%, aggregate branches at least 90%,
and each firewall source at least 85% branches. Existing floors and populations
are preserved. Inventory/hook checks fail before inclusion; the new campaign is
registered after a missing-campaign first-red. All three fault partitions retain
complete campaign coverage. Complete final ordinary/type/AST and existing coverage
fault follow-up are retained separately.

The historical Phantom source note supplies the accepted default-network/tool
contract. Current documentation routes were inaccessible to the browser and the
official-domain search returned no result; no current published-package or live
Phantom compatibility claim follows from this local implementation.

Hosted predecessor 588a1ef run 37849341848 fails the unchanged staged-baseline wait
in all runtime jobs, AST and partition one; partitions two/three pass. Full output
and job metadata are retained in `filter/hosted-588a1ef/`. H11 remains pending;
no wait, runtime population, mutation definition/seed or product threshold changes.

```sh
node --test apps/firewall/test/filter.test.ts
node evals/firewall/filter-faults.ts
node --test evals/ci/coverage.test.ts evals/ci/coverage-hook.test.ts
node --test evals/ci/bite.test.ts evals/ci/bite-partitions.test.ts
node evals/ci/coverage-faults.ts
npm test
npm run typecheck
npm run test:coverage -- --serial
```

Final serial AST run passes all 751 cases and every unchanged floor. The firewall
records 52 of 52 statements and 52 of 53 branches; exact source hashes/counts are
retained in `filter/coverage-summary.json`. This is local component qualification,
not a passing hosted run. The original eight-case coverage output remains retained
as an intermediate result; final claims use the nine-case source and final run.
Fresh ordinary suite also passes 751 cases; native typecheck exits zero. All thirty
existing coverage fault trials pass and restore after the final AST run. Product
hashes in that report still match the final files. Claims/document lints pass.
Private sync and complete hosted qualification follow; no success is presumed.
Typecheck errors not saved as complete original logs are explicitly labelled
partial transcriptions in `filter/typecheck-findings.txt`.
Staged close flags the artificial redaction-test assignment at test line 28;
`filter/close-fixture-finding.txt` transcribes that finding. It is explicitly
agent-written fixture data, not a credential/key. Rename it to a redaction
sentinel and preserve the assertions; no scan/gate change. Repeat focused/fault
and ordinary/type checks. Product-source hashes and coverage counts are unchanged.
After the fixture rename, nine focused cases, all sixteen filter/coverage faults,
751 ordinary cases and native typecheck pass. The unchanged close scan then passes;
pre-sync close reports only the uncommitted tree. No scan exemption or weakened
pattern is introduced. Final evidence filenames carry the `sentinel` suffix.
