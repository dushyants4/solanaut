# Signed policy foundation — POL-1 to POL-5, VER-1 and VER-2

Measured 2026-10-05, starting revision `6b0dc04`; implementation revision is the commit
containing this receipt. Node 26.7.0, Keel 1.0.1, sensor v1. Builder-authored evidence;
not independent RT-2, Phantom evidence or an isolated deployment qualification.

## Failed first

The initial signing-text/verifier stubs caused all 14 initial cases to fail (`signed-policy/red.txt`).
These blocked fixture construction as well as positive behaviour; they do not alone establish
negative signature enforcement. The deliberately disabled checks below establish that separately.
The additional unknown record-version case failed before format validation was added
(`signed-policy/record-version-red.txt`). Initial typecheck found two array/Uint8Array fixture
mistakes, corrected without changing assertions.

## Passes

`node --test packages/sdk/test/signed-policy.test.ts`: 18 tests pass. They cover canonical
readable text, actual ed25519 verification, externally pinned operator/guard/cluster, unsigned
and dishonest summaries, canonical signature encoding, versions, unsupported profiles, trusted
sensor identity, history replay, CLI trust pins and preserved reservations/receipts/latch.
`signed-policy/green.txt` retains the output.

The SDK retains its existing unsigned trusted mode. Passing `authorization` enables signed
history; a signed history cannot subsequently open without external trust. The isolated signer
must require authorization. Thus this is the foundation of milestone 3.2, not its complete
isolated-product exit gate. No new socket method or live policy swap exists.

## Planted faults

Each was applied separately and reverted. Nine caught faults; the first profile injection
was missed because a forged fixture mistakenly included its old hash in the resealed body.
Corrected the fixture to create a valid hash chain; repeated that fault and observed rejection.
The miss is retained as `signed-policy/fault-profile.txt`, alongside the corrected failure.

| Fault | Named failure | Output |
|---|---|---|
| omit cryptographic signature verification | POL-4's forged historical signature | `fault-signature.txt` |
| trust a signed summary without deriving it | POL-2's dishonest summary | `fault-summary.txt` |
| omit external guard/cluster binding | POL-2's guard and cluster substitutions | `fault-identity.txt` |
| accept unsupported profiles | VER-2, after fixture correction | `fault-profile-corrected.txt` |
| omit restart version/content checks | POL-5/VER-1 | `fault-version.txt` |
| forget reservations on policy restart | POL-4's new cap check | `fault-reservations.txt` |
| accept arbitrary sensors under sensor v1 profile | VER-2 | `fault-sensor.txt` |
| drop the CLI's external trust input | POL-4's replay command | `fault-cli.txt` |
| permit a genuinely signed older policy in history | VER-1's recorded rollback | `fault-history-version.txt` |

Outputs live under `signed-policy/`; early fault runs used the then-existing 16 cases, the
CLI fault used 17. The final 18-case battery includes the corrected profile fixture and format
validation. Regenerate with the named expressions disabled, run the battery, then restore.
Extending the policy window initially forgot spending already pruned under the old window
(`window-red.txt`). Restore/replay/inspection now retain the largest required history window
during reconstruction; live pruning returns to the active window. The extension regression passes.

## Contracts and limits

The new fifth entry kind records canonical policy text, authorization version/signature and
the evaluation profile. Its format version remains separate from its policy version. Equal
versions require identical content and signed text; a higher version preserves admission state.
Unsupported format/profile refuses restore. Signed replay and inspection require external trust.
Legacy records retain the existing explicit-policy replay and accepted ADR-012 divergence.

Canonical `issued` timestamps use UTC with milliseconds. Non-integral minutes in the readable
window summary use an exact reduced fraction. The profile binds current rule, decoder and sensor
identities and both Keel digests; future semantics require a new supported profile.

Remaining: signer-enforced authorization, policy preparation in the operator CLI/Phantom,
key-rotation ceremony, independently anchored history, streaming/snapshots and upgrade drills.
The existing file-store ownership and short-write weaknesses remain separate work.
