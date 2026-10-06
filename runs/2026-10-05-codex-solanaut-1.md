# 2026-10-05 — codex-solanaut-1

## Asked

Implement the approved Solanaut 1.0 mission: stable individual Linux deployment on devnet,
then a separately qualified mainnet follow-on. Retain every existing readiness gate and
prepare the original repository for eventual human-approved public release.

## Did

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
- Detailed signer crash recovery, snapshots, evaluation-version compatibility, RPC trust,
  opaque-program bounds, anchor exposure and operator exceptions need proposed contracts
  before their affected implementation. Do not build on unaccepted proposals.
- Existing human dependencies remain: funding, tool approvals, separate OS users, Phantom,
  outside developers, Claude's RT-2, specialist audit, bounty, licence and each public action.
- Owed edit O1 (also HANDOFF §6): replace the AGENTS build convention with native TypeScript
  development plus the explicitly authorised release-only JavaScript/declaration build. The
  exact text is in the handoff; Codex does not edit the protected law.

## Provenance

Starting revision: `e925f1d`. Pins and thresholds: `TOOLCHAIN.md`, `docs/READINESS.md`.
Baseline commands: `npm test`, `npm run typecheck`,
`uv run --script tools/session_close.py --slug codex-solanaut-1`.
Scratch output for this session belongs in `.sandbox/solanaut-1/`.
