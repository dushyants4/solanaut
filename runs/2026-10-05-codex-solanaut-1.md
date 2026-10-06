# 2026-10-05 — codex-solanaut-1

## Asked

Implement the approved Solanaut 1.0 mission: stable individual Linux deployment on devnet,
then a separately qualified mainnet follow-on. Retain every existing readiness gate and
prepare the original repository for eventual human-approved public release.

## Did

- RPC boundary committed and pushed as `c9a84e0`. SIG-4/10 attribution/clock foundation begins
  there: five cases, four initially fail and compatibility passes, then five pass; five mutations
  caught. Full product suite 256 passes, typecheck and packed SDK checks green. Receipt:
  `evals/signer/authority.md`. Source/mode/anchor are host attribution, not OS isolation evidence;
  actual service wiring and H4 remain owed. Helpers stay in signer budget accounting.

- Executor committed and pushed as `54ba32f`. RPC-1–4 begins from that revision; ten tests fail
  against a stub then pass, seven valid faults caught after an integer-validator fault escaped the
  original fixture. Added coherent fractional contexts and ID substitution with otherwise valid
  shapes. Initial miss preserved in `evals/signer/rpc.md`. Full product suite 251 passes; typecheck
  clean. Single public devnet genesis read matched the pin; no real transaction send. Official RPC
  documentation checked and linked in the receipt. Current-only blockhash lifetime is a conservative
  implementation choice within ADR-019; older valid hashes refuse, and missing history never proves
  expiration. No live outage or process isolation qualification inferred.

- Signing journal pushed as `948d6a5`; local close passes all checks and CI `37401878957` passed.
- LIF-3 executor: initial six tests fail against stub; complete twelve-case battery passes with
  fake RPC. Five valid mutations caught; two invalid/classification fault runs rejected and
  preserved. Receipt: `evals/signer/core.md`. Full product suite 241 passes; typecheck clean.
  New source accounting includes SDK signing helper: 156 lines, below the unchanged process
  budget before transport/provider implementation, not final SIG-11 qualification. No actual
  chain send, key-file read or OS-user action. Restart fixtures reconstruct durable prefixes.

- User asked to continue without stopping. Both live probes again refused correctly; baseline
  from `425dcc8`: 220 product tests pass, typecheck clean. CI `37401222564` passed.
- LIF-2 signing journal: nine tests fail against missing API, nine pass after implementation;
  seven maintained faults caught. Record facts share the admission chain and verify wire/signature,
  redemption, lifetime, ordering and response identity. Details: `evals/sdk/signing-history.md`.
  This helper is counted with the signer rather than hidden by its SDK location. Process budget
  remains at most 500 lines before executor/transport implementation. No gate or threshold changed.
  Fixture spread ordering was corrected before implementation; fixtures were strengthened to
  separate admitted-byte binding from cryptographic validity. No old assertion weakened.

- Ownership/storage committed and pushed as `033cd87`; post-push close passes all checks;
  CI `37400891997` passes Node 22.18.0, 24 and 26.7.0 and the office job.
- LIF-1 starts from that revision. Optional SDK request identities are committed atomically with
  admission, and verified on restore/replay. Initial eight tests fail; eight pass after implementation;
  four maintained faults caught. Full suite 220 passes, typecheck clean; receipt and commands:
  `evals/sdk/request-identity.md`. No existing assertion weakened. IDs use bounded ASCII; payload
  is exact bytes/group, excluding observed time/heights/deadlines. Full request index is in memory
  pending disk-index work. Signer lifecycle and its deadline enforcement remain unbuilt.

- Signed-policy foundation final verification: `npm test` passes 203 tests, typecheck exits 0,
  the rebuilt packed candidate passes its battery. The pre-commit close gate passes every
  check except the expected uncommitted-tree gate; staging the new files also passes the secret scan.

- The human instructed “Go aheaaad, Continue the plan” after the explicit ADR-019/020
  acceptance request. Recorded acceptance; no release gate or T4 grant changed.
- Repeated both live probes on this continuation; both correctly refused. Baseline at
  `5b4d3d6`: product tests and typecheck pass. Trusted signing work starts from this revision.
  Signer-process line budget before implementation: at most 500 lines across all its helper files,
  excluding the existing SDK, as required by SIG-11 and ADR-019.

- `f16938c` passed CI run `37397843820` on Node 22.18.0, 24 and 26.7.0, including
  installed-package and package fault checks. Post-push local close gates passed.
- Automated the seven already demonstrated ADR-012 faults as a maintained CI-1 subset.
  The baseline and restored source pass; each mutation fails assertions with the full battery run.

- Read the root law, handoff, progress, accepted requirements and readiness documents.
- Fetched the private remote; the starting revision is `e925f1d`, with a clean working tree.
- Both live probes were refused by the boundary guard: the patch and shell attempt to create
  the forbidden probe file. No probe file was created. Repeated successfully on resume.
- The parallel tasks were interrupted by an account usage limit; none left working-tree changes.
- Recorded the mission before continuing ADR-012 option C, the first accepted implementation item.
- Baseline `npm test`: 161 pass, no failures; typecheck exits 0. The initial session-close run
  passes 9 of 10 gates and correctly fails for uncommitted mission work.
- Added LAT-1 to LAT-6 tests. Against V0, 13 of 24 fail for the intended behavioural differences;
  with C, all 24 pass. Seven separate planted faults produce assertion failures and were reverted.
- Replayed every available scene record before and after; the accepted `latch` divergences are
  seq 8 for local/devnet and seq 9 for cockpit. No tracked JSONL files exist.
- Drafted ADR-019 and ADR-020 as proposals and requested acceptance while continuing independent work.

## Changed

- Signed policy preparation/verification, canonical summaries, external trust pins, policy entries
  and supported evaluation profiles. Restore/replay/inspection select recorded policies.
- Public replay CLI accepts signed history with an external public trust file; old invocation remains.
- POL/VER battery and receipt; source SDK mode remains advisory, isolated enforcement is next.

- Release-only SDK compiler and private staging script; native source exports retained.
- Installed package tests, packaging guide and receipt; CI runtime matrix and package checks.

- `docs/plans/2026-10-05_solanaut-1.md`: the human-approved mission and dependency order.
- This record: baseline, findings and outstanding dependencies for the continuing session.
- `packages/sdk/src/guard.ts`: accepted predecessor-based latch decision, derived from the record.
- Latch regression tests, archived stream helper and `evals/sdk/latch-c.md` with raw evidence.
- SPEC, claims, overview, risk/progress/handoff and document register: current implementation,
  accepted replay break and remaining human dependencies.
- ADR-019/020: concrete proposed contracts, not implementation or accepted architecture.

## Found

- RPC commit `c9a84e0` CI `37402929454` failed on Node 22.18.0 with one cancelled hung-read test;
  other runtimes passed. A standalone child reproduced premature event-loop exit on Node 26.
  Replaced the unreferenced abort-helper timer with an owned referenced timer and finally cleanup.
  No deadline or assertion widened. Attribution commit `aecdf8e` was already made before the
  failed CI log was examined; it did not correct this inherited issue. Receipt and initial
  failure: `evals/signer/rpc-deadline.md`. Local full suite now 257 passes, typecheck clean;
  corrected matrix still must pass before a green-CI claim. Eight valid RPC faults caught.

- Signing stubs fail all initial cases, but block negative fixture setup too; actual disabled
  security checks establish their negative failure evidence. The unsupported-format case fails
  before its validator. The final signed policy battery passes 18 cases.
- Nine policy faults caught. The first profile fault was missed: the fixture included its old
  hash when resealing, so it failed before profile validation. Corrected the fixture and observed
  the intended failure; retained both outputs. Two array/Uint8Array type errors also corrected.
- Extending a window forgot spending pruned under the old window. The new regression fails first;
  restore/replay/inspection retain the required history while rebuilding, then live pruning uses
  the active policy. Genuinely signed historical policy rollback is also caught separately.

- Matrix CI `37397657426` failed offline package setup on all runtimes with `ENOTCACHED`
  for Keel metadata. Product tests, typecheck and compilation passed. Added explicit pinned
  metadata caching, preserving offline consumer installation, and verified with a fresh cache.

- `2030ef7` passed local close gates and GitHub CI run `37397016363`.
  The baseline CI run `37369485468` failed to acquire a hosted runner for the office job;
  its guard tests and typecheck passed. H6 no longer blocks reading CI.
- All four package tests failed against the source tarball. The release compiler initially
  rejected `findLast` at ES2022; the candidate targets ES2023 on the approved Node runtimes.
- The first installed consumer under `.sandbox` masked a missing dependency through ancestor
  resolution. Moved it outside the repository, then repeated baseline and all four faults.
  Four package tests now pass; all four damaged candidates fail, restored before final checks.
  See `evals/packaging/packed-sdk.md` for retained outputs and commands.

- The live boundary hooks are active for both tested tool paths.
- The interrupted tasks produced no implementation or evidence; their inspection is not a passed gate.
- The approved Alpha and stable-release thresholds remain unmeasured in this session.
- Initial new test helper failed Node's strip-only parser; corrected before behaviour measurement.
  Initial typecheck found a fixture generic error; corrected. Neither is red-first product evidence.
- A shell attempt to generate a patch was refused by the boundary heuristic because its text
  contained a protected shape and a mutating verb. The instructed exact `apply_patch` tool was used;
  no alternate shell route or protected-file write was attempted.
- Historical replay now differs exactly where the accepted ADR said it could; those failures
  remain findings, and S12's old devnet latch note remains until its funded rerun.
- The close gate rejected S13's date in its status cell: the gate requires it in the evidence
  cell. Moved the same measurement date into evidence; the gate itself was not changed.

## Open

- `31abf16` is pushed; its post-push session-close gate passes all ten checks.
  Package fault injections now have a maintained sequential CI runner, restoring original bytes
  even on failure. The complete milestone 3.9 fault and measurement programme remains outstanding.

- Packaging verification: `npm test` passes 185 tests; `npm run typecheck` exits 0;
  `npm run test:package` passes four tests. Pre-commit session close passes nine gates and
  correctly fails the uncommitted-tree gate. Its redirected invocation was refused by the
  boundary heuristic; reran the documented unredirected command, without editing any gate.

- ADR-012 is verified offline; its funded devnet rerun is outstanding.
- ADR-019/020 are now accepted. Detailed signer recovery, snapshots, profile compatibility,
  RPC trust, opaque fallback, anchors and operator exceptions can proceed under those contracts.
- Existing human dependencies remain: funding, tool approvals, separate OS users, Phantom,
  outside developers, Claude's RT-2, specialist audit, bounty, licence and each public action.
- Owed edit O1 (also HANDOFF §6): replace the AGENTS build convention with native TypeScript
  development plus the explicitly authorised release-only JavaScript/declaration build. The
  exact text is in the handoff; Codex does not edit the protected law.

## Provenance

Ownership/storage step starts from `4a60f0a`: implemented accepted ADR-019 with a parent-held
flock descriptor, stable kernel mutex, stale manual refusal, missing-history refusal and complete
synced writes. OWN battery initially three failures and one pass; storage tests initially passed
after helper implementation (test-first gap retained). Focused battery nine passes; six maintained
faults caught; full product suite 212 passes; typecheck clean. Commands and raw evidence:
`evals/sdk/ownership.md`. Source mutation batteries run sequentially.

Changed assertion: durable test's automatic stale takeover expectation now additionally requires
manual refusal before explicit kernel recovery, under accepted ADR-019. Workload child and demo
select kernel ownership; original restart hash comparison and crash assertions remain. No live
demo run this step. No OS user, key, network filesystem or power-loss qualification claim.
Read-only shell redirect naming the protected law was refused by the heuristic; used the
documented read without a redirect. A documentation patch failed matching a partial version
line, and a receipt/index patch failed matching the index heading; corrected exact patches.

Starting revision: `e925f1d`. Pins and thresholds: `TOOLCHAIN.md`, `docs/READINESS.md`.
Baseline commands: `npm test`, `npm run typecheck`,
`uv run --script tools/session_close.py --slug codex-solanaut-1`.
Scratch output for this session belongs in `.sandbox/solanaut-1/`.
