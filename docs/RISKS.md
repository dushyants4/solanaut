# RISKS.md — what could stop the Alpha, and what is done about it

> **1.41** · 2026-10-07 · owner: architect, with the evaluator · for: the human, every seat · not public. Part of
> milestone 2c.1 in `docs/ROADMAP.md`, approved by the human on 2026-10-05; kept current through Leg 3. Register: `kb/DOCUMENTS.md`.

The frozen 9ac6e7c mutation guard target is superseded by D21's independent semantic
finding. Its actual supervised interruption and qualification refusal are retained.
Definition 7 adds authentication and malformed-history coverage while preserving
earlier scope/floors/limits; a passing staged baseline is not a mutation score.
40fa2fc's hosted Node 22 job fails while Node 24/26 and coverage pass. Cause and
remediation require the completed job's log; do not infer matrix success locally.
The completed log confirms the staged-baseline wait; serial file execution is
prepared for corrected hosted qualification. Separate retained/additional score
floors prevent population expansion from concealing a weaker earlier result.

The internal prefix preparation component has full replay and fault evidence,
but does not establish authenticated consumption, atomic publication or full
snapshot recovery. Its sources/tests must join the next frozen mutation definition.

The threat model ([docs/papers/THREAT-MODEL.md](papers/THREAT-MODEL.md)) lists what an attacker can do to a running
guard: threats T1 to T30. This register is wider. It lists what could stop Solanaut being delivered as specified, or
make it claim more than it shows. A threat appears here only when it is also a risk to delivery, and then by its ID.

Archive catalogue preparation checks metadata and hashes its canonical bytes
(`evals/sdk/checkpoint-archives.md`). Forged receipts still require refusal through
actual file verification before authenticated restore. Publication, state replay,
freshness and independent snapshot qualification remain owed.

An external sequence/head now binds the archive prefix (`evals/sdk/archive-anchor.md`),
but its source, network, account authority and commitment still require authentication.
It cannot cover rewritten history after the anchor or replace authenticated state replay.
ADR-022's enrolment/rotation design awaits the human; no dependent programme is built.
The original FIFO startup readiness assertion fails under concurrent mutation-run load;
retain that failure and validate sequentially without weakening its deadline.

Policy preparation returns unsigned public text (`evals/sdk/prepare-policy.md`), without
reading current policy history. The operator must review and sign the exact bytes, and the
service must enforce pinned trust and increasing versions. Neither preparation nor a valid
signature alone proves a safe policy replacement or the human-run Phantom workflow.

Performance report checks do not establish actual performance. Public ledger differential
data verifies byte/reference agreement, with explicit conservative trailing-data refusals;
it does not establish a benign false-stop rate, CPI safety, Token-2022 extensions or mainnet
execution. Source corpus bytes must pass publication/history review before public visibility.

Frozen synthetic benign traffic passes its local target (`evals/ci/traffic.md`), but
alternating and distinct failed-outcome streams continue admitting within its horizon.
This remains a loop-control limitation requiring architectural and independent review,
not grounds to tune coefficients or claim that changing-intent loops are stopped.

Stryker preparation verifies staged-source isolation and report refusal paths
(`evals/ci/mutation.md`); the actual score is still owed. Its dependency addition introduces
moderate advisory findings through `typed-rest-client`/`qs`, retained in the audit evidence.
Signature authenticity does not resolve them or establish security qualification.

Archive verification now rejects observed source changes and checks optional external pins
(`evals/sdk/archive.md`). A self-consistent forged chain remains possible without independent
authentication. This foundation does not close signed-snapshot, bounded-state replay, backup
recovery or hostile-filesystem risks; operator-owned immutable local archives are required.

The checkpoint codec authenticates externally pinned metadata and opaque payload digests
(`evals/sdk/checkpoint.md`). A signature alone does not establish state semantics, freshness
or tail continuity. It must not become a state-restoration shortcut: authenticated prefix
replay and comparison with full replay remain required before startup uses checkpoints.

The completion-record checker binds evaluation identity and refuses incomplete/error results
(`evals/ci/run-completion.md`), but cannot establish that a host-produced result is truthful.
Actual detached waiting, protected result storage, durable publication and interruption
evidence remain required. No report file or structurally valid fixture substitutes for them.

The detached supervisor now has actual child/process-group-loss and ordered publication
evidence (`evals/ci/run-supervisor.md`). Supervisor SIGKILL, escaped process groups,
inherited environment and malicious same-user storage remain residuals. It is not yet
used for mutation qualification and cannot retroactively qualify the original orphan.

Explicit evaluation environment binding excludes inherited loader/undeclared variables
when selected (`evals/ci/run-environment.md`). Default inherited mode does not offer that
assurance. Killed-supervisor evidence is refusal plus separate fixture containment, not
automatic recovery. Host compromise and escaped workers remain residuals.

AST statement/branch coverage now measures complete SDK/signer inventories with calibrated
counters (`evals/ci/coverage.md`). Its initial deficit was remediated with failure-path tests;
no product rule or threshold changed. This does not establish mutation score, independent
security review or the remaining reliability/performance gates. Existing dependency advisories
remain despite verified signatures on the new development-only instrumentation packages.

**Scales.**
- **Likelihood:** low, unlikely before the Alpha closes; medium, plausible; high, already seen, or expected.
- **Impact:** low, costs time; medium, a milestone slips or a claim narrows; high, a leg busts, or a claim would be
  wrong; critical, real funds or a key exposed.

**Owners** are seats (CLAUDE.md) or the human. Each risk is reviewed at every milestone review, and closed only with
evidence.

## 1. The product

| ID | Risk | L | I | Mitigation | Indicator | Owner | Status |
|---|---|---|---|---|---|---|---|
| RK1 | A loop that changes its shape and amount each turn is not stopped by Keel | high | medium | bounded by the fee window and the INHIBIT clamp; the Alpha's red team measures it; a rule on runs of failed outcomes is the candidate fix (`docs/SPEC.md` §12) | the loop battery's alternating case | architect, evaluator | open: not stopped in 12 turns (`evals/sdk/keel.md`) |
| RK2 | The latch stops a well-behaved agent after one early re-sign | high | medium | accepted ADR-012 C built and tested offline (`evals/sdk/latch-c.md`); replay differences retained | scene 5 on devnet | builder, evaluator | mitigated offline; funded devnet rerun owed |
| RK3 | In SDK mode the caller supplies time, heights and outcomes, so a lying caller widens what is admitted (T20, T21) | medium | high | the signer process fetches them itself (milestone 3.1); until then the limit is stated in SPEC §2.1 and every claim is scoped to SDK mode | — | architect, builder | open until 3.1 |
| RK4 | Agent frameworks sign twice or report landed payments as failed, so integrations hit refusals or retry real payments | high | medium | D14 closed; `guardedWallet` follows up what it signed; integrators pass whole transactions; findings sent upstream (M12, M13) | refusals as `intent-in-flight` in the adapters battery | integrator | mitigated for Solana Agent Kit 2.0.10; ElizaOS unknown until 3.6 |
| RK5 | A listed Token-2022 mint changes a mutable setting after the operator checked it (T15) | low | high | only listed mints; the extension set pinned and re-read at admission (3.3) | — | builder | open until 3.3 |
| RK6 | Opaque programs, such as a Jupiter route, cannot be bounded within the Alpha (T3, T28) | medium | high | opaque programs stay denied by default; 3.4 is gated on a Jupiter route bounded on a Surfpool mainnet fork; if the gate fails, the Alpha ships with them denied and says so | 3.4's gate | architect | open |
| RK20 | Wallets that vary the priority fee per payment read as fee escalation: 15 of 3,000 benign payments stopped, each latching the guard | low | medium | S7 scoped to constant fees; candidate: score escalation only against attempts that did not land, measured on fresh seeds before any change (`docs/SPEC.md` §12) | the varied-fee benign battery (`evals/independent/e3-edges/`) | architect, evaluator | mitigated: built 2026-10-03; on fresh seeds 0 of 3,000, every loop's stop turn unchanged (`evals/sdk/fee-escalation.md`) |
| RK7 | Durability across a power loss rests on `fsync` and is not measured | low | medium | S6 says "a crash", never "a power cut"; the on-chain limit bounds what a lost record could cost | — | evaluator | accepted, stated |

## 2. Dependencies

| ID | Risk | L | I | Mitigation | Indicator | Owner | Status |
|---|---|---|---|---|---|---|---|
| RK8 | Keel changes: a new release changes behaviour or its digest, or an upstream finding (U-1 to U-4) bites | medium | medium | the module and controller pinned by SHA-256; any bump re-runs the Keel and sensor batteries before its digest is accepted | a digest mismatch at `createGuard` | builder | mitigated (S4) |
| RK9 | Solana changes: Alpenglow's timing on mainnet, new instructions, new transaction formats | medium | medium | unknown versions and unlisted instructions are denied; 4.3's pre-flight re-checks commitment and expiry, and no timeout assumes 400 ms slots | release notes, SIMDs (`kb/sources/`) | architect | watched |
| RK10 | The Squads config authority is a single point of control (T30) | low | high | stated; a fresh operator account for any live test; the operator holds no other funds | — | the human | accepted, stated |
| RK11 | Framework churn: Solana Agent Kit, kit or ElizaOS change the interfaces the adapters wrap | medium | low | versions pinned; the adapters battery runs in CI | a failing adapters battery | integrator | watched |

## 3. Delivery

| ID | Risk | L | I | Mitigation | Indicator | Owner | Status |
|---|---|---|---|---|---|---|---|
| RK12 | Independent evaluation is hard to get: outside agent CLIs are refused when run unattended, and the account's usage limit stopped a multi-agent run | high | medium | runs the human starts; this session's subagents, given only the spec and audited for black-box reads; R.2's external audit | an owed evaluator run | evaluator, the human | mitigated for the Beta: three evaluators, 317 cases, six defects closed (`evals/independent/`); the Alpha's red team (RT-2) needs it again |
| RK13 | Decisions wait on one person: ADRs, sign-offs and every T4 step | high | medium | batch milestone decisions; independent work continues while one is open | open decision older than a milestone | the human, archivist | Beta and ADR-012/019/020 accepted; later sign-offs remain |
| RK14 | The Alpha's thresholds are ambitious, and Leg 3 busts on any miss: 95% coverage, 80% mutation, a million fuzz inputs, 1,000 mainnet transactions, a 72-hour soak, three outside developers | high | medium | all thresholds confirmed on 2026-10-05; preserve them and record misses without lowering them | — | evaluator, the human | confirmed; qualification owed |
| RK15 | The contest's deadline (2026-10-12) pressures claims past the evidence | medium | high | every public sentence traces to `docs/CLAIMS.md`; `tools/claims_lint.py` gates each measured row; the human submits only achieved milestones | a sentence in a draft with no row | archivist, the human | mitigated |
| RK16 | The public devnet RPC rate-limits and its faucet refuses, stalling devnet milestones | high | low | reads back off, sends never retry; the drills resume on existing accounts; the human funds the operator; 4.3 requires two RPC providers | HTTP 429s in a run record | operator | mitigated for the Beta |
| RK17 | Reusing the Gubernaut workspace's tooling would breach the isolation the project exists under | medium | medium | the boundary guard; CLAUDE.md's isolation rule; any change to it is the human's, recorded as an ADR | a request to use APEX tooling | harness | mitigated |

## 4. Keys and operations

| ID | Risk | L | I | Mitigation | Indicator | Owner | Status |
|---|---|---|---|---|---|---|---|
| RK18 | A key leaks: a devnet key read by an outside model, or a real-funds key placed in this tree | low | low for devnet; critical for real funds | no real-funds key in the tree; devnet keys gitignored and made by `solana-keygen`; the secret scan at every close; outside agents jailed away from `keys/` | the secret scan | operator | mitigated |
| RK19 | The live Phantom test goes wrong: a misclick, or a compromised operator wallet (T18, T30) | low | high | devnet first, as the human chose; a fresh account; the runbook passes twice before (4.2); real funds only under ADR-008, by the human | — | the human | open until Leg 4 |

## Changes

Solanaut 1.0 inspection also found the documented stale-lock race, missing signer lifecycle
evidence and the execution-relative gap in opaque balance floors. ADR-019/020 are accepted.
Signed policy/version/profile checks now have offline evidence (`evals/sdk/signed-policy.md`);
isolated enforcement and the remaining recovery mitigations are not built. Opaque denial remains.
The stale-lock race now has a tested Linux kernel ownership path (`evals/sdk/ownership.md`);
manual SDK mode refuses stale markers. Operator-owned local storage remains an assumption.
Checked signing history and the conservative executor have offline evidence (`evals/signer/core.md`).
Actual RPC trust, source records, process isolation and kill qualification remain open under RK3/RK7.
RPC validation and conservative failover have fake-provider evidence (`evals/signer/rpc.md`).
Only current blockhash lifetimes are accepted; unseen expired attempts retain reservations. The
availability costs need live integration evidence, and RK16's reliable-provider request remains open.
Host attribution and monotonic-clock helpers are tested (`evals/signer/authority.md`), but flags
do not prove dedicated-user isolation. RK3 remains open until the operational signer is qualified.
The Unix transport has local permission, framing, deadline and abandoned-process evidence
(`evals/signer/socket.md`). Its recovery must be wired after exclusive record ownership;
transport tests do not establish multi-process service startup or dedicated-user access.
Status/report request journalling has SDK evidence (`evals/sdk/control-request.md`), but handler
service wiring and pre-admission proposal errors remain open. Method deadlines/coalescing have
fake-host evidence (`evals/signer/handler.md`). Older readers refuse the new entry kinds;
compatible rollback must be checked against actual history, not just policy versions.
Pre-admission refusal history now has local executor/journal evidence (`evals/signer/refusal.md`);
operational supervision and full kill qualification remain open. Invalid protocol frames are
not journalled. Refusal history does not release an admitted attempt's unresolved reservation.
Recovery no longer aborts later attempts when one operation fails (`evals/signer/recovery.md`).
Incomplete pass results must be displayed as degraded; they do not imply restored storage
health or resolution. Policy-change recovery and operational supervision remain open.
Signed-policy upgrade recovery is now checked across admission, signed and send-started
boundaries (`evals/signer/policy-recovery.md`). A settled signing/send-intent loophole is
closed with live/replay regressions. Operational policy upgrades and supervision remain owed.
Same-user host startup/draining now has local evidence (`evals/signer/service.md`). Its
recorded count exceeds SIG-11; ADR-021 is proposed and dependent expansion waits on H9.
The factory still injects signing/RPC, so key isolation and provider trust are not established.
Socket consumers now have explicit ambiguity errors and no automatic transport retry
(`evals/sdk/sending-client.md`). Callers can still create a fresh payment identity after
uncertainty; the integration guide warns against it, and intent/cap rules remain the bound.
Fault aggregation now detects missing/stale campaigns and unrestored source. Its first full
run finds an old selector mismatch (`evals/ci/bite.md`). CI-1 remains partial for historical
manual findings; this does not establish coverage, a mutation score or independent security.
Frozen synthetic properties enforce completed executions and compare to the external codec
(`evals/ci/properties.md`). They do not establish real-transaction coverage or policy security.
The dependency audit still reports existing high advisories in the framework/on-chain tree;
authenticity checks do not resolve them. No release exception is claimed.
The decoder's frozen mutation workload now reaches its million-input local target with
enforced process/totals evidence (`evals/ci/fuzz.md`). It remains synthetic and does not
qualify policy caps, signing lifecycle or real transaction decoding.
Separate SOL cap properties now compare per-tx/pending-window behaviour to independent
bigint arithmetic (`evals/ci/caps.md`). Their quiet unsigned in-memory profile isolates
those rules; token/fee caps, real storage, signer and sensor/Keel qualification remain owed.
A mixed replay workload now pins its record digest to detect correlated record/replay
changes (`evals/ci/replay.md`). Its initial old-receipt failure and cap mutation miss
demonstrate bounded coverage; focused regression added without changing the pinned history.
Queued SDK callers now exercise the pending-window bound and complete identity evidence
(`evals/ci/concurrency.md`). Their single-guard in-memory profile does not establish separate
writer races, socket capacity or isolated-signer durability; those drills remain required.
Verified owner-death trials now check kernel ownership release and recovered SDK state
after acknowledged prefixes (`evals/ci/kills.md`). Actual signals are checked; sending a
kill is not enough. Unacknowledged-write, signing/send and power-loss evidence remains owed.

The publication preflight now inventories the inspected original-origin history as Git
metadata (`evals/ci/history.md`). It does not assess secrets, confidentiality, source rights
or hosted unreachable-object exposure. Final candidate/ref-set review remains required;
local harness tree refs are refused, not silently omitted or changed.

Planted cap trials now retain the first actual counterexample rather than shrinking a
deliberately broken rule until containment (`evals/ci/caps-first-failure.md`). Ordinary
qualification still shrinks and enforces its full execution floor. Incomplete/error/signalled
child processes refuse credit even if they print a failure and exit one. The initial hosted
failure remains retained; corrected hosted validation and the complete CI-2 programme are owed.

| Version | Date | What changed |
|---|---|---|
| Draft 1 | 2026-10-01 | First register, for milestone 2c.1: 19 risks, from the Beta's run records, `docs/SPEC.md` §12, the threat model and `kb/REGISTRY.md`. |
| Draft 1.1 | 2026-10-03 | RK20 added, from the independent evaluator's varied-fee battery, then mitigated the same day; RK12's status updated. |
| 1.0 | 2026-10-05 | Approved by the human with the Alpha's scope (milestone 2c.1). |
| 1.29 | 2026-10-06 | PUB-1 prepares an exact historical metadata inventory; publication-scope confidentiality, secrets and source-rights review remain open. |
| 1.30 | 2026-10-06 | SNP-3 binding authentication is a component only; payload semantics, freshness, prefix replay and restore remain open. |
| 1.31 | 2026-10-07 | CI-2 cap-fault diagnostic/completion correction preserves ordinary shrinking, all successful floors and deadlines; failed hosted evidence remains visible. |
| 1.32 | 2026-10-07 | CI-2 completion-record checks are a foundation; trusted actual production and durable publication remain open. |
| 1.33 | 2026-10-07 | CI-2 actual supervision component evidence; full mutation integration and remaining containment risks explicit. |
| 1.34 | 2026-10-07 | CI-2 explicit environment binding and interruption refusal; automatic supervisor-death containment remains owed. |

Mutation execution now checks actual supervised completion and frozen inputs. The
interrupted original campaign is retired without an inferred exit status or score;
fresh complete qualification remains owed (`evals/ci/mutation-recovery.md`).

The evaluation-tool qs route is remediated by a scoped exact published override
(`evals/ci/dependency.md`). High framework/native-buffer findings remain open;
local compatibility evidence does not imply upstream endorsement or release clearance.

The preceding recovery revision fails the oldest-runtime hosted job. Its baseline
option spelling is corrected with captured-command regressions; local passes do not
replace the required corrected hosted matrix (`evals/ci/mutation-runtime.md`).

Malformed checkpoint signature decoding now has a fixed encoded-size refusal
(`evals/sdk/checkpoint-signature.md`). JSON capture, complete snapshot restoration
and its bounded-memory/startup targets remain separate outstanding requirements.
