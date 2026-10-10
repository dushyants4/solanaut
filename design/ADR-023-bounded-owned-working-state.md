# ADR-023 · Bounded owned working state

**Status: proposed, not accepted.** 2026-10-09. The human decides before
dependent retention, checkpoint-format or resource-admission changes. ADR-019's
security contracts and all readiness thresholds remain required.

## Context and inspected evidence

The private owned facade now serialises admissions, controls, redemption,
trusted reports and operator release. It does not bound retained history.
`record.ts` keeps `entries`; `state.ts` keeps historical requests, responses
and signing facts. `request-index.ts` streams a selected lookup shard, but
preparation captures the entire input and constructs all rows and shard text.
`checkpoint-state.ts` serialises those maps into the existing admission-state
format. These are source observations, not memory or restart measurements.

Deleting the maps alone would remove evidence used to refuse duplicate identity,
redemption and signing stages. A final outcome may still leave an interrupted
response to complete. A later signed policy may extend a spending window;
discarded reservations must then be reconstructed from retained evidence before
admission. Unknown outcomes cannot be evicted to create space.

Time windows alone do not specify an absolute memory ceiling. Unresolved
attempts may accumulate, and low-value proposals still carry decision, intent
and signature evidence. The accepted design requires bounded active state but
does not specify how exhaustion refuses work or how compact checkpoint state
coexists with the current full-map format. This proposal resolves those choices
explicitly rather than treating input streaming as completion.

## Proposed decision

Keep the trusted synchronous SDK and existing checkpoint readers compatible
with their present contracts. Introduce a separately versioned compact owned
checkpoint payload; never reinterpret the current admission-state format.
Bind its version, evaluator identity, exact durable endpoint, independently
pinned authorities, archive catalogue and historical-index root in the signed
envelope. Unsupported readers refuse it before service readiness.

The compact payload retains active reservations and intents, used receipts for
those decisions, unfinished lifecycle/control facts, latch, sensor view,
current policy and the previous decision needed by replay. Historical terminal
facts remain on disk. A snapshot never loads numerical Keel controller state:
rebuild through the authenticated event prefix and verified tail as ADR-019
requires. Preserve retained complete history for independent full replay.

Add explicit positive finite operator-owned limits for active decision and
pending-control counts in protected configuration. These are resource ceilings,
not permission to release reservations or alter spending caps. Before accepting
new work, account for its worst permitted working-state contribution. If it
cannot fit, persist a payload-bound pre-admission refusal through the existing
request-error mechanism and return an actionable typed resource error. No
signature, redemption or send occurs for that refused work. Denied/completed
request evidence is committed directly to disk, not retained indefinitely.

The limits and accounting become explicit configuration/SPEC contracts after
acceptance; values are declared before qualification. They cannot be tuned to
pass benign traffic or soak results. Restoring a valid history exceeding the
configured capacity refuses readiness without removing evidence; recovery or
an operator configuration change happens under maintenance. Existing targets,
including benign false-stop, restart and soak, remain unchanged.

Every operation needing an evicted fact consults verified disk evidence bound
to the current durable endpoint. Include historical identity retries, late
signing responses, duplicate redemption, final-outcome refusal and control
answers. Absence needs complete authenticated coverage, including the tail;
an old published index is insufficient. Corruption or missing evidence rebuilds
from verified history or refuses. No caller-supplied index or snapshot object
can mint provenance.

Construction must also avoid history-sized intermediates: stream the canonical
record, build disk projections with bounded buffers, and retain only active
facts in the owned path. Do not introduce an unreviewed database dependency.
Choose and test the projection construction algorithm as a separate accepted
implementation allocation; a new dependency or material format contract comes
back for review. All publications remain under the actual exclusive owner and
retain the previous valid generation across interrupted writes.

Policy changes run under maintenance. Verify the higher signed version, stream
retained history to reconstruct the new window and validate capacity before
resuming. Failure leaves admissions stopped and evidence intact. Never install
a larger window against a silently truncated in-memory spending history.

## Acceptance evidence and exit conditions

Tests must fail first for evicted identity collisions and cached answers,
late lifecycle replies, double redemption, final versus unknown outcomes,
window extensions, capacity boundaries and restored over-capacity state.
Plant false absence, omitted tail, released unresolved reservation, ignored
capacity, mismatched endpoint, old-format reinterpretation and unsigned-state
faults. Retain each failure and miss beside corrected results.

Compare compact restore and continued decisions with retained full replay over
the approved runtime matrix. Include policy changes, latch/release, unresolved
attempts and interrupted responses. Validate competing starts, storage faults,
missing/corrupt index generations, signed but foreign payloads and checkpoint
fallback. Packed consumers and the eventual installed service receive the
same negative cases.

Freeze workloads, capacity settings, analysis, machine and runtime before
measurement. Measure actual readiness with historical requests serviceable,
not snapshot parsing alone. Run the unchanged restart, throughput, replay,
coverage, mutation, benign-traffic and soak gates. Report working memory as a
function of active state and buffer limits, including temporary construction
space and restoration peaks. A scoped benchmark never replaces the complete
release programme or independent security review.

## Costs, alternatives and deferred work

Resource ceilings can refuse useful traffic until reconciliation or maintenance
reduces active state. Disk-backed late lookups and bounded construction add I/O,
complexity and new failure surfaces. Format changes require compatibility and
rollback evidence; unsupported rollback must refuse rather than discard state.
These costs belong in user diagnostics, qualification and the specialist audit.

Alternatively retain the existing full-map implementation and describe its
memory honestly; it does not complete SNP-7 or the stable release gate. Another
alternative needs an explicitly reviewed capacity/storage design, not map
deletion. No ceiling values, database, migration, new signer socket method,
signer budget expansion, key handling or publication is authorised by this
proposal. H9 remains a separate prerequisite for signer wiring.
