# Durable state: shown failing, then passing

Milestone 2a.6 in [docs/ROADMAP.md](../../docs/ROADMAP.md): the hash-chained record synced to disk before each answer;
restore by replay on start; one writer per record; `replay()`; defect D11 closed ([docs/SPEC.md](../../docs/SPEC.md)
§7, [ADR-010](../../design/ADR-010-log-is-state.md)). Run on 2026-10-01 with Node 26.7.0 and `@gubernaut/core` 1.0.1,
on Linux (ext4).

| File | What it is |
|---|---|
| `packages/sdk/src/record.ts` | the stores: in memory, or a file with one entry per line, each synced before the guard answers, under a lock file |
| `packages/sdk/src/guard.ts` | `createGuard({ policy, log })` restores by applying every entry again, Keel included; `close()`; `replay(entries, policy)` |
| `packages/sdk/bin/replay.ts` | `npm run replay -- <record.jsonl> <policy.json>` |
| `packages/sdk/test/durable.test.ts` | 10 tests |
| `packages/sdk/test/support/workload.ts`, `workload-child.ts` | a deterministic 160-step workload, and the process the battery kills |

## 1. Failing first

The battery ran against stubs: `log` was accepted and ignored, `close()` did nothing, `replay()` threw.

```
ℹ tests 9   ℹ pass 1   ℹ fail 8
```

The one pass checks that the workload produces every kind of entry a restart must restore. It runs in memory and
needs nothing new.

## 2. Then passing

```
  workload: 160 entries: allow 67, redeem 16, deny:destination-not-allowed 16, report 16, deny:malformed-proposal 7,
            deny:intent-in-flight 15, release 15, deny:over-window-cap 6, deny:latched 1, deny:unsupported-version 1
✔ the reference workload exercises what a restart must restore
✔ the record is synced to disk entry by entry, and a guard reopened on it has every entry
✔ D11: a reopened guard decides as the uninterrupted one would: windows, intents, the latch and Keel survive
  restart battery: 20 kills; the record has 160 entries
✔ the restart battery: SIGKILLed at 20 random points and restarted each time, the record ends identical to an uninterrupted run
✔ a torn final line, the mark of a crash mid-write, is dropped: it was never acknowledged
✔ a record that is broken before its last line refuses to start: fail closed
✔ one writer: a second guard on an open record refuses; a lock left by a dead process is taken over
✔ replay recomputes every decision from its bytes and names the first divergence
✔ a record that cannot be written denies, and the guard stays shut
✔ npm run replay: exit 0 for a record that replays, 1 with the divergence under a narrower policy, 2 for no policy
ℹ tests 10   ℹ pass 10   ℹ fail 0         (npm test: 108 of 108; 11 and 109 with the latch test below)
```

**The restart battery is stronger than the spec asked.** `docs/SPEC.md` §11 asks that the state restored after each
kill equals the state before, checked by replay. Here, a child process runs the workload against a record file and is
killed with SIGKILL after a random 1 to 5 acknowledged steps, at whatever point it has reached, writes included. It
is restarted on the same file, 20 times, and then run to the end. The final record must equal an uninterrupted
in-memory run of the same workload **entry for entry, hash for hash**, and it does. Every decision after every restart
was the one the uninterrupted guard made, Keel's postures included. `replay()` then recomputes all of it from the
bytes, with no divergence.

**The workload was strengthened before it was trusted.** Its first version latched in most cycles, and never produced
an intent in flight or a window-cap denial, so a restart's handling of those went untested. It now produces every
kind of entry, and the first test fails if any kind is missing.

**A gap found and closed while writing these tests: the latch was derived, not recorded.** Applying entries
recomputed the latch from the run of denials and the policy's `afterDenials`, so a guard restored under a policy with
a higher threshold came back unlatched. A policy change would have released a latch that only the operator may
release. A test was written for it. It passed at first, for the wrong reason: its three identical drains made Keel
return REGROUND, which latches under any policy. With three different drains 30 seconds apart, it failed. The
decision that trips the latch now records it (`latch: true`), and applying the record reads that fact. The test then
passed, and `npm test` ran 109 of 109.

## 3. Eight planted bugs: six caught, one untestable here, one equivalent

| Planted bug | Failing tests |
|---|---|
| restore does not re-tick Keel | 2 |
| restore does not reset Keel at a latch release | 3 |
| a torn last line skipped but not cut, so the next entry joins it | 1 |
| any lock taken over, live or not | 1 |
| a failed write does not shut the guard | 1 |
| replay compares nothing | 1 |
| no fsync after each entry | **0: untestable here** |
| hashes not verified when the file is opened | 0: **equivalent** |

- **fsync.** A killed process leaves its writes in the operating system's page cache, so SIGKILL cannot tell a
  synced record from an unsynced one. Only a power loss can, and nothing here simulates one. The sync stays, and the
  claim is scoped: a record survives a process crash, as measured; surviving a power loss rests on `fsync`, untested.
- **Hash verification on open is redundant.** Restore checks every entry's hash again, so the guard still refuses a
  damaged record. Both checks stay; the file's check reports the line number.

The replay command was written before its test; reporting a divergence with exit code 0 fails that test.

## 3b. Found by the independent evaluator: a release the record did not verify (D17), and a lock message

The black-box evaluator e2-state (`evals/independent/e2-state/`) found on 2026-10-03:
- **D17:** a sealed release entry with an all-zero signature un-latched a guard on restore, and `replay` called the
  record sound.
- **The lock:** a lock file naming no process refused correctly, but with "locked by process undefined on undefined".

Their cases became tests in `durable.test.ts` (S83, S81), and in `admission.test.ts` for the three admission defects
(section 6b of `sdk/admission.md`). All five were seen failing for the evaluator's reason:

```
✖ S36: a receipt reported expired, failed or landed no longer redeems          after expired, the receipt redeemed
✖ S80: a release's expiry is judged on the latest recorded time …              released: true
✖ S82: an attempt a trusted height shows can still land stays in the window …  got an ALLOW
✖ S83: a release in the record is verified on restore and in replay …          Missing expected rejection
✖ S81: a lock file that names no process refuses to start …                    "process undefined on undefined"
ℹ pass 0 · fail 5
```

After the fixes, the five pass, and `npm test` passes 159 of 159.

**The fix:** `apply` verifies each release as the live guard does: the signature by the release key over its text,
the guard and cluster, the latch's seq, and the expiry against the entry's own time. Restore, replay and the live
guard all pass through it. The lock message now names the file and how to clear it.

## 4. Limits, stated

- **The lock's takeover is not atomic.** Two processes restarting on one record at the same instant could both take a
  stale lock. Run one guard per record.
- **The whole record is read on start, and held in memory.** Snapshots that bound both are Alpha work (ADR-010).
- **Measured on one machine and one file system.** Durability on other file systems, and across power loss, is not
  claimed.

## Regenerate

- `node --test packages/sdk/test/durable.test.ts`
- `npm run replay -- <record.jsonl> <policy.json>`
