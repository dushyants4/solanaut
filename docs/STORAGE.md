# Persistent record ownership

> **Draft 15** · 2026-10-27 · owner: integrator · for: SDK users and Linux operators.
> Register: `kb/DOCUMENTS.md`. Foundation evidence: `evals/sdk/ownership.md` (claim S16).

The guard's record is its state (ADR-010), so where it lives decides what survives a crash. This page says how to
give a guard a persistent record on Linux, what the writer checks before it acknowledges an entry, and how to verify
a stopped archive.

## Choosing ownership

An ordinary `createGuard({ policy, log: path })` uses manual SDK ownership. It refuses an
existing ownership marker even if its PID is dead. Stop every writer before operator repair;
never delete a marker to make an active record available.

On Linux, choose kernel ownership explicitly:

```ts
const store = fileStore(path, { ownership: "kernel", create: false });
const guard = await createGuard({ policy, log: store, authorization });
```

`create: false` is for an established identity. Initial setup must explicitly create its record
using `fileStore(path, { ownership: "kernel" })`, close it, and retain that history thereafter.
This SDK option is a foundation; the isolated signer's enforced bootstrap workflow is still owed.

The writer opens a stable mutex inode and passes its descriptor to `/usr/bin/flock` for
nonblocking exclusive acquisition. The parent retains that descriptor until close or death.
The utility's exit does not release the parent's lock: Linux associates it with the shared
open-file description. See [Linux flock semantics](https://man7.org/linux/man-pages/man2/flock.2.html).
Kernel mode never unlinks its mutex. Manual mode cannot take over a kernel marker.

Use an operator-owned directory on a local Linux filesystem. The agent must not be able to
replace the record or its mutex. Network filesystems, distributed writers and mixed old/new
active binaries are unsupported. Stop all old writers before upgrading to this ownership mode.
The initial Ubuntu reference installation still needs clean-machine qualification.

## What the writer checks

The store completes short writes and syncs before acknowledgement. A write or sync failure
closes the writer; restart may retain an unacknowledged complete entry conservatively. This
does not prove power-loss durability. Back up history and ownership configuration together;
verified backup, rollback, snapshots and the full recovery programme remain release work.

The live journal and its mutex must both be single-link regular files. Hardlinked
aliases refuse ownership rather than opening the same journal through different
pathname locks. Stop all writers and retain evidence before resolving an alias;
do not remove mutex names to clear a lock. Failed startup releases its acquired
ownership. This does not prevent privileged concurrent host changes. Evidence:
`evals/sdk/record-alias.md`.

Post-sync acknowledgement requires the original held mutex and named journal
inode to remain current. Replacement refuses and permanently fails the writer;
do not remove a foreign marker during cleanup. Stop all writers and verify both
inodes before operator recovery. Evidence: `evals/sdk/record-write-identity.md`.

After each complete append and sync, the physical byte count must equal the
previous count plus the canonical entry bytes. A mismatch acknowledges nothing
and permanently fails the writer. Retain physical evidence and stop all writers
before operator recovery. Evidence: `evals/sdk/record-write-completion.md`.

Before each append, the writer also compares descriptor byte count and nanosecond
modification/change times with completed startup or its last synced append.
External changes fail that store permanently without adding another line. Restoring
the original bytes does not revive it. Stop all writers, retain evidence and verify
the intended history before a compatible restart. This is a metadata consistency
check under the signer-host trust boundary; it neither authenticates content nor
prevents privileged changes during a write. Evidence: `evals/sdk/live-record.md`.

Record reads also compare descriptor size and nanosecond modification/change times
before and after reading, and recheck inode identity. Observed changes refuse before
parsing or torn-tail repair. Failed startup releases ownership and retains the
changed evidence. Stop all writers and verify the intended immutable history before
operator recovery; a metadata comparison does not freeze the host or source.
Evidence: `evals/sdk/record-read-stability.md`.
The complete raw read must match the descriptor's byte count before any repair.
A short or oversized result refuses while retaining the original evidence.
Genuine incomplete tails are cut at byte newline boundaries, preserving complete
entries even when the suffix contains a partial UTF-8 character. Evidence:
`evals/sdk/record-read-completion.md`. Full-history allocation remains unbounded.

## Internal maintenance

Internal maintenance now also publishes derived request-index generations under
actual kernel ownership. Each new generation is complete and synced before an
atomic pointer replacement; earlier generations and history are retained. The
pointer is a cache hint, never recovery authority. Restart must independently
replay retained signed history under configured policy pins before using it.
Corrupt or changed evidence refuses publication. A publication storage failure
fails the writer; do not delete evidence to clear it. These internal capabilities
are not operator commands or public SDK exports. Prefix lookup cannot establish
current request absence, and bounded live state/startup remain unqualified.
Evidence: `evals/sdk/owned-request-index.md`.

Internal current-head request lookup now authenticates that disk prefix and folds
the complete signed-validated tail under the actual owner. It requires an existing
index and returns both endpoint pairs with immutable evidence; absence is qualified
only through that current head. It shares maintenance exclusion and refuses late
owner, record, cache or pointer changes. It performs no writes or repairs, and an
answer cannot authorise an admission without a serialized head check. Full history
and construction remain retained. Evidence: `evals/sdk/request-index-lookup.md`.

An internal owned proposal companion now serializes that consultation with
evaluation/commit. It requires a genuine signed guard and actual owned evidence;
changed heads or unavailable indexes refuse admission. Historical decisions remain
payload-bound across policy changes; retries do not free reservations or reuse
receipts. This adds no public root export or operator command. It keeps every
historical map and array: pruning requires a distinct private async facade so
trusted synchronous APIs cannot bypass historical lookup. Evidence:
`evals/sdk/owned-request-admission.md`. Full memory/startup gates remain owed.

## Verifying an archive

For a stopped, immutable archive, the SDK exports `verifyArchive(path, options)`:

```ts
const receipt = await verifyArchive(archivePath, {
  expectedHead: independentlyRecordedHead,
  expectedDigest: independentlyRecordedSha256,
});
```

Both pins are optional; retain them independently when verifying a backup. The receipt
contains entry count, sequence range, final head, SHA-256 of exact bytes and byte count.
Continuation archives require `firstSeq` and `previousHead`. `maxLineBytes` limits each
UTF-8 record excluding its final newline. Invalid options, framing, envelope, chain, observed
source changes and pin mismatches throw `ArchiveError` with a typed `code`.

This checks structure and pinned bytes, not policy decisions, signed checkpoints or restored
state. An empty archive does not establish an existing guard. Use a single-link regular file
in an operator-owned local Linux directory; stop writers before copying and verifying it.
Verification detects observed changes during its read and does not freeze the source afterwards.
Evidence and precise limitations: `evals/sdk/archive.md` (S39). Full snapshot and backup
recovery qualification remains owed.

An independently trusted anchor may also be supplied as
`expectedAnchor: { seq: anchoredSequence, head: anchoredHead }`. The archive must contain
that exact sequence and head; a missing anchor or a resealed rewrite before it refuses.
On success the receipt includes the captured `anchor`. A continuation starting after that
anchor cannot prove it and is refused. This verifies an external pin; it does not fetch or
authenticate RPC, program, network, guard identity or authority. Obtain those bindings through
the operator's trusted configuration and verified chain evidence. A rewrite after the latest
successful anchor remains outside its coverage. No fixed wall-clock exposure is promised.

### The command

The installed candidate also supplies a read-only operator command:

```bash
solanaut-verify-archive history.jsonl --head "$recorded_head" --sha256 "$recorded_sha256"

solanaut-verify-archive history.jsonl --anchor-seq "$anchored_sequence" --anchor-head "$anchored_head"
```

From the source checkout, use `npm run verify-archive --` with the same arguments. Run
`solanaut-verify-archive --help` for optional continuation and line-limit flags. The command
prints a JSON receipt on success, or a JSON `error` with `code` and `message` on archive
refusal. Incorrect arguments print usage; automation can distinguish these exit statuses.
See SNP-2 evidence and the exact exit contract in `evals/sdk/archive-cli.md` (S40).

| Error code | Operator action |
|---|---|
| `input` | Correct the verification options, continuation sequence/head and pin or byte-limit shape before retrying. This refusal does not establish anything about the archive's contents. |
| `source` | Check the file exists, permissions allow reads and it is a single-link regular file on supported local Linux storage. |
| `framing`, `record`, `chain` | Retain the failed copy and original evidence. Check the complete copy, continuation identity and compatible record format; do not edit history to make it verify. |
| `changed-source` | Stop writers and create a fresh immutable copy before verification. |
| `head`, `digest` | Check the independently retained pins against the intended archive. A mismatch is evidence to investigate, not a reason to replace the pins with the observed result. |
| `anchor` | Retain the mismatch or missing history. Check the independently trusted anchor, configured guard/program/network/authority and complete archive; refuse recovery while they disagree. Never replace the pin with the observed head to clear the failure. |

Successful verification still needs authenticated policy replay and a tested recovery drill
before a backup can be declared recoverable. The command neither admits proposals nor signs.
The two anchor flags must be supplied together. Structural evidence and installed-consumer
limits are in `evals/sdk/archive-anchor.md`; the deployed program and enforced signer restore
still require their own qualification. ADR-022 is a proposed program contract, not implemented.
