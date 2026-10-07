# SNP-3 — reject invalid signature size before decoding

2026-10-07 · builder-authored Linux, Node 26.7.0; base `9ac6e7c`
plus this candidate. Checkpoint authentication component only.

The old verifier decodes arbitrary-length signature strings before checking the
Ed25519 result. A child fixture intercepts base64 decoding of invalid sizes and
fails first. Exact encoded size now refuses before that decoder. The signatures'
canonical encoding remains checked; equal-length altered pad bits cannot reuse a
valid signature. This is a decoder bound, not a claim that caller-owned JSON capture
uses bounded memory or that the complete snapshot programme is implemented.

Nineteen focused cases and twenty-three real faults pass with source restoration.
The old packed SDK fails the installed size regression. Rebuilt JavaScript passes
nine consumer cases and six compiled artefact faults, with restoration. Regenerate:
`node --test packages/sdk/test/checkpoint.test.ts`,
`node evals/sdk/checkpoint-faults.ts`, `npm run release:prepare`,
`npm run test:package`, `node evals/packaging/faults.ts`, `npm run typecheck`.

Concurrent low-priority root integration fails existing baseline and policy-source
timing checks. Preserve that diagnostic beside sequential normal-priority integration
and AST coverage; no deadline, workload or floor is changed. The independently frozen
mutation candidate retains its own earlier checkpoint source and cannot qualify this
new helper change. Full snapshot payload/replay/publication and release gates remain owed.

Raw evidence: `checkpoint-signature/`. These are builder tests, not independent review.

Final ordinary integration passes all 546 cases under explicit CPU 0/4 affinity,
normal priority, unchanged fixture limits; typecheck exits zero. Both instrumented
local runs refuse the baseline-wait case, including the sequential affinity run.
Neither is a coverage pass. Private sync uses the required ordinary/type/close gates;
corrected hosted coverage remains required and any failure returns to remediation.
The preceding runtime revision's hosted run 37611898486 passes all jobs.
