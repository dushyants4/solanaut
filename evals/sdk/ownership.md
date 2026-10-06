# OWN/STO — exclusive Linux recovery and complete storage writes

Measured 2026-10-05, starting revision `4a60f0a`; implementation is the commit containing this
receipt. Node 26.7.0, Linux local filesystem, `/usr/bin/flock` util-linux 2.42.3. Builder-authored
evidence, not independent RT-2 or clean Ubuntu installation qualification.

## Failed first

`node --test packages/sdk/test/ownership.test.ts` against the prior store: four tests, three
failures and one pass. Stale SDK takeover, mutex deletion and missing-history creation fail their
behavioural assertions. The competing-process case passed the old implementation in this run;
that pass alone did not establish atomic recovery. Raw output: `ownership/ownership-red.txt`.

The storage failure cases were written after the complete-write helper and passed initially.
They are not red-first evidence. The injected faults below prove short-write and sync assertions
can fail; existing SIG-8 already has its durable-state baseline.

## Current result and regeneration

`node --test packages/sdk/test/ownership.test.ts packages/sdk/test/storage-failures.test.ts`:
nine tests pass (`ownership/ownership-storage-green.txt`). OWN-1–3 and STO-1–2 cover stale refusal,
exclusion after helper exit, SIGKILL followed by eight competing restarts, stable mutex, missing
history, short writes, ENOSPC, permission loss, zero progress and sync failure.

`node evals/sdk/ownership-faults.ts` checks a green baseline, plants each fault separately,
requires the complete battery and a behavioural assertion failure, restores exact source in
`finally`, then checks green again. All six caught (`ownership/ownership-maintained-faults.txt`):

| Fault | Rejected by |
|---|---|
| ignore flock result | second writer exclusion |
| automatic manual stale takeover | stale SDK refusal |
| unlink kernel mutex | stable mutex and safe reopening |
| create missing established history | missing history rejection |
| acknowledge a single short write | complete newline and JSON hash |
| swallow append fsync failure | fail-closed admission and writer shutdown |

No missed fault in this battery. Run sequentially with other source mutation batteries.
`npm test` passes 212 tests including the existing 20-kill hash-for-hash restart battery;
`npm run typecheck` exits zero. These do not satisfy the specified 100-kill release target.

## Decisions, changed assertions and limitations

The parent's retained descriptor shares the helper's open-file description and holds its lock
after helper exit: [Linux flock semantics](https://man7.org/linux/man-pages/man2/flock.2.html).
This implements accepted ADR-019 without PID-based stale takeover. Kernel mode retains its
mutex inode; the store verifies inodes before writes and syncs new directory names.

The existing durable test additionally requires stale manual ownership refusal, then recovers
explicitly in kernel mode. The workload child and SIGKILL demo choose kernel mode; their exact
record comparison and crash assertions remain. The demo was not rerun on chain.

Network filesystems, mixed running legacy binaries and multi-host ownership are unsupported.
The operator-owned-directory assumption remains. OS-user isolation, signer enforcement,
backup/upgrade drills, snapshots and power-loss validation are not established here.
