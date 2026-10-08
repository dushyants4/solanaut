# Sending-client input containers — CLT-1/3

Measured 2026-10-08 on local Linux x86-64, Node 26.7.0. Revision:
the commit containing this receipt, following private candidate `39c24de`.
Evaluator-authored regressions and a separate builder's correction are part of
the same Codex team; this is not independent security or live-chain evidence.

## Found and failed first

The documentation assigns `SignerClientError` code `input` to invalid
configuration and payloads. The constructor instead destructured missing/null
options before validating them, while `propose` and `report` accessed payload
fields first. Arrays/functions carrying valid fields could pass the field checks.

The existing invalid-input test was enhanced without adding or removing a
top-level case. `node --test packages/sdk/test/sending-client.test.ts` initially
passes ten and fails one: missing options raises an ordinary `TypeError`, failing
the typed-error assertion. Full original output:
[`sending-client-input/first-failure.txt`](sending-client-input/first-failure.txt).
This is an observed contract failure, not a planted source fault.

## Corrected behaviour and passing evidence

Runtime options and request containers must be non-null objects other than
arrays; functions and primitives are refused before field access. Ordinary
objects/classes retain the existing field contract. Every refusal in the
enhanced test must be `SignerClientError`, with `code === "input"` and
`mayHaveExecuted === false`.

The test covers omitted arguments, null, undefined, primitives, arrays/functions
with and without otherwise valid fields, all three client methods, and the
previous invalid socket, identity, timeout, message size, group size and deadline
fields. Additional checks retain byte-message, text-group and decision-hash
validation. The local socket receives zero requests.

After the builder's guard correction, the same command passes all eleven cases:
[`sending-client-input/final-focused.txt`](sending-client-input/final-focused.txt).
The public export list, declarations and three-method client surface are
unchanged. The earlier source's runtime root inventory and candidate hashes were
reviewed read-only; that review does not qualify a newly rebuilt artefact.

The existing installed-client case was also enhanced, preserving the eleven-case
package inventory. It imports from the package root in an actual offline tarball
installation outside the repository. Options and all three method payloads use
the same typed refusal contract, including arrays/functions carrying otherwise
valid fields, and a local socket must receive zero invalid requests.

Before rebuilding the old compiled stage,
`node --test --test-name-pattern='installed sending client' evals/packaging/packed-sdk.test.ts`
fails its one selected case for the same missing-options `TypeError`, from the
external consumer's installed JavaScript rather than the workspace source.
Original output:
[`sending-client-input/installed-first-failure.txt`](sending-client-input/installed-first-failure.txt).
After `npm run release:prepare`, the complete installed battery passes all
eleven cases in `sending-client-input/installed-final.txt`, including the actual
offline preview example and public declarations.

## Maintained planted faults

`node evals/sdk/sending-client-faults.ts` retains every original trial and catches
seventeen faults. The seven added trials remove each options/status/propose/report
guard or remove the shared array/type/null restriction. Each must terminate with
the eleven-case battery reporting a meaningful assertion failure. Signals,
timeouts, missing modules, syntax errors and reference errors do not earn credit.
The runner restores the exact source bytes after each trial and re-runs the
restored battery. No final miss is recorded.

Output and exact trial names:
[`sending-client-input/faults-final.txt`](sending-client-input/faults-final.txt).
The earlier ten-trial receipt remains unchanged in
[`sending-client.md`](sending-client.md).

The existing compiled-package campaign retains all sixty-seven trials and adds
seven matching container-guard/helper damages, each required to fail the installed
client case. `node evals/packaging/faults.ts` catches all seventy-four trials and
restores the candidate; complete output is in
`sending-client-input/compiled-faults.txt`.

## Integrated candidate evidence

`npm test` and `npm run test:coverage -- --serial` each pass 718 cases;
`npm run typecheck` exits zero. All existing AST floors pass; the client has
108/113 statements and 111/117 branches covered. Full output and the source-bound
coverage summary accompany this receipt. Enhanced native and installed cases
preserve the prior top-level populations rather than removing work.

Definition 23 declares fresh seed 25307 before measurement of the expanded test
body. The expected-definition test fails first against definition 22. Existing
source/test populations, staged count 442, all waits, per-mutant deadlines,
supervisor limit and floors remain unchanged. The isolated
`node evals/ci/mutation-recovery-faults.ts` campaign catches fifteen recovery/driver
faults and restores sources. This qualifies a staged baseline, not a mutation score.

Hosted candidate `39c24de` run 37777805134 fails the unchanged baseline wait in
the runtime matrix and fault partition one. Partition two also rejects the
checkpoint-state fault's old apply-state literal after D23's context argument.
The exact retained logs are in
`../release/staged-preview/hosted-39c24de/`. Updating that literal targets the
same omitted state operation; `node evals/sdk/checkpoint-state-faults.ts` now
catches all sixteen trials and restores source. No trial or failure is hidden.

The refreshed private tarball is
`.sandbox/solanaut-1/staged-preview-client/solanaut-sdk-0.0.0.tgz`; its complete
pack metadata, digest and source identities are retained in
`../release/staged-preview/client-candidate.json`. The first preview's manifest
and artefact remain separate. `docs/PREVIEW.md` compares tarball and companion
example digests before installation. It is a trusted synthetic SDK walkthrough,
not installed signer or outside-user qualification. No version/private flag changes.

Regenerate the build and pack with `npm run release:prepare` and
`npm pack ./.sandbox/releases/sdk --ignore-scripts --pack-destination .sandbox/solanaut-1/staged-preview-client --json`.
Run the source, installed, ordinary, type, coverage and fault commands above.

## Limits and qualification owed

This checks argument container shape and established field validation. Throwing
getters/proxies are outside the promised sanitisation contract. No RPC, signing,
sending, dedicated-user isolation or publication occurs. A local socket fixture
does not establish complete service deployment or chain settlement.

Exact follow-up hosted qualification remains required. Local passes and success
inside a failed hosted job do not clear it; H11's wait proposal remains pending.
The unchanged readiness thresholds, protected gates and signer budget remain
in force.
