# Persistent record ownership

> **Draft 2** · 2026-10-06 · owner: integrator · for: SDK users and Linux operators.
> Register: `kb/DOCUMENTS.md`. Foundation evidence: `evals/sdk/ownership.md` (claim S16).

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

The store completes short writes and syncs before acknowledgement. A write or sync failure
closes the writer; restart may retain an unacknowledged complete entry conservatively. This
does not prove power-loss durability. Back up history and ownership configuration together;
verified backup, rollback, snapshots and the full recovery programme remain release work.

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
