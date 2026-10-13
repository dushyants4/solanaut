# SDK denial disclosure integrated

2026-10-13 Toronto · starting b673466901417a9e90ed23c133627d67c95013b2.
Builder-authored local Node 26.7.0/Linux evidence, CLAIMS S158. The implementation
revision is the commit containing this receipt; this is not independent review.

The frozen SPEC class table precedes implementation. The initial disclosure
population fails every case. Default wallet and kit adapter errors now carry
only class/reference; operator callbacks receive detached, frozen details after
persistence. Callback exceptions emit fixed stderr diagnostics outside the
decision chain. Unknown adapter exceptions cannot expose their original text.

Full disclosure requires a verified operator-signed policy and marks decisions;
replay refuses a resealed missing marker. Omitted disclosure preserves legacy
policy bytes. Synthetic write failures produce an unrecorded reference, never a
false durable decision. SDK code can still inspect neighbouring guard state;
this is not secrecy from a compromised process or protection against inference.

Initial implementation/type-fixture failures remain alongside the first red
tests. The first full run passes 941 and fails ten historical error-field
assertions. The accepted API change moves those assertions to the operator
callback, retaining their safety checks; the single current table is
`docs/reviews/2026-10-13-disclosure-assertions.md`.

Final disclosure checks pass 43 cases. Six source faults are caught: leaked rule,
leaked reason/limit, skipped callback, full default, unsigned full disclosure and
missing record marker. Exact source is restored, then all 43 pass again.
Full native tests pass 951, typecheck passes, and the compiled installed-package
population passes 19; no skip, cancellation or todo. The installed population
checks existing package consumption, not a separate installed privacy battery.
The exact hosted `npm run test:coverage -- --serial` passes all unchanged AST
floors. The preceding default concurrent command fails the unchanged staged
baseline wait under load; its output is retained, not pooled with the serial pass.

```sh
node --test packages/sdk/test/disclosure.test.ts
python evals/release/disclosure-faults.py
npm test
npm run typecheck
npm run release:prepare
npm run test:package
npm run test:coverage -- --serial
```

Preserve prior fault output before regeneration. Larger raw output remains under
`.sandbox/evidence/2026-10-13-development/`; `disclosure-inputs.json` binds its
hashes and sizes. No hosted CI logs are committed. Hosted run 38437894194 keeps
the previous passing jobs green but its package-fault jobs remain time-limited;
Claude's runner edits are owed. Signer socket projection, live key loading,
independent security review and stable-release qualification remain unfinished.
