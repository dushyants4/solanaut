# Native same-user signer executable

2026-10-13 Toronto · builder-authored Node 26.7.0/Linux evidence, S160.
Starting fe21906209b851a6592a9097218568adcabee7ac; implementation is the commit
containing this receipt. This does not qualify stable or isolated deployment.

The native executable loads a protected public config and a protected devnet key,
checks the complete keypair/public half and sole policy principal, constructs
the operator's devnet RPC boundary, and starts the existing persistent service.
Explicit `--init` creates signed history without resetting an existing record.
Normal startup restores it. Signal handlers request orderly draining. Only the
public address/signing closure leaves the key loader; no key bytes leave IPC.

The initial key-loader population fails all nine cases; initial CLI input checks
fail both. The final expanded ordinary executable population passes twenty.
Ordinary positive composition uses memory-only synthetic bytes through an explicit
test descriptor shim; its physical fixture contains public whitespace. This is
not evidence of a real persisted key. The separate subprocess battery makes its
key with the installed `solana-keygen`, loads it from an owned real protected
file, kills the actual executable during send, then restarts it. It proves one
stored signature/send-start and one fake-provider send; automatic follow-up
records provider-confirmed settlement. No key contents are printed/copied, and
the generated unfunded key is removed. One kill is not the required full battery.

Failures remain beside passes: the first process oracle offers the wrong blockhash
and correctly causes no send; instrumentation warnings initially break exact
diagnostic checks; a short-read fixture's own ceiling is miscounted. Test-only
warning suppression and an inclusive size control resolve those fixture issues.
Parent permission loss during read is a real prototype defect, D43, corrected
after its failure. An initial mode-check omission escapes malformed key tests;
an independent valid-public-file case now checks refusal before any byte read.

D44 corrects unavailable malformed-proposal classification, with its first failure
and durable retry. D45 makes transport errors use verdict/reference/class too.
Their initial transport cases fail; eleven old fixed-code assertions then fail
the accepted API change. Their replacements retain every original safety case
and named-test population in the single current assertion table. The client
keeps execution uncertainty and rejects private/legacy error fields. A missing
reference is not evidence that no earlier admission/signature happened.

Eight new executable omission faults are caught with exact restoration; twenty
ordinary cases pass after restoration. The updated follow-up campaign catches
its seven original faults with the additional decoding regression and complete
populations. Original socket/client campaigns retain their faults. Additional
transport/decode trials catch all four omissions, then restore exact source and
pass 23 combined cases. Original campaigns still catch nine socket, seventeen
client and eight service faults. The final keygen-backed process recheck passes.

Full `npm test` passes 983, typecheck passes, compiled installed-package tests
pass 19, and the exact serial AST coverage command passes unchanged floors;
no skip, cancellation or todo. Installed-package tests qualify SDK consumption,
not distribution of the native executable. The conservative source inventory is
623 physical lines, including all app source and SDK signing/authority/control
helpers. General shared SDK code and the agent-side client are excluded under
ADR-021; no code moves to evade the limit. The candidate fits its specified
budget, but complete SIG/Alpha qualification remains outstanding.

```sh
node --test apps/signer/test/key-loading.test.ts apps/signer/test/executable-inputs.test.ts apps/signer/test/executable-startup.test.ts apps/signer/test/protected-file.test.ts
node --test evals/signer/process.test.ts
python evals/signer/executable-faults.py
python evals/signer/transport-faults.py
python evals/signer/followup-faults.py
node evals/signer/socket-faults.ts
node evals/sdk/sending-client-faults.ts
node evals/signer/service-faults.ts
npm test
npm run typecheck
npm run release:prepare
npm run test:package
npm run test:coverage -- --serial
wc -l apps/signer/src/*.ts packages/sdk/src/signing.ts packages/sdk/src/authority.ts packages/sdk/src/control-request.ts
```

Preserve prior fault output before regeneration. `executable-inputs.json` binds
raw bytes/sizes under `.sandbox/evidence/2026-10-13-development/`; no hosted logs
are committed. All network sends in this battery go to fake loopback providers.
Live devnet awaits an operator RPC pair and protected signed configuration.
Dedicated-user isolation, finalized unpinned lookup reads, full signer kill and
concurrency programmes, Linux installation and independent/stable gates remain.
