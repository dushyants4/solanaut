# Post-sync journal and mutex identity

Builder-authored local evidence, 2026-10-09 Toronto, Linux/Node 26.7.0,
base `3fe0f0d` plus candidate. Accepted ADR-019; OWN-2, STO-2, SIG-8.

Actual journal or mutex replacement during the write callback is acknowledged
in both ownership modes. Four cases fail first on acknowledged sequence. The
prior physical-size check sees the old descriptor's valid size, so it cannot
establish that the named history or mutex remains the same inode.

After complete write and sync, recheck the held owner and named journal identity
before size validation, cache mutation and acknowledgement. A mismatch permanently
fails the store, leaves both inodes as evidence and does not remove another
writer's marker. This is observed identity consistency under the trusted host
boundary, not an atomic filesystem transaction or privileged tamper protection.

All forty focused cases, seventeen source faults, eighteen installed cases and
872 native cases pass; typecheck exits zero. Quiet serial AST executes 872:
871 pass and the unchanged staged-baseline wait fails. Preserve raw reports;
no complete coverage/floor pass is claimed. All 138 retained compiled faults
catch; restored eighteen-case consumer baseline and final typecheck pass. Every
bound product/evaluation/emitted-file/archive hash matches after restoration.
Update the existing swallowed-sync fault's insertion anchor for the
new line, retaining its semantics and strict checker. Keep every previous fault;
add separate post-sync owner and journal faults. Do not claim independent security,
bounded recovery or a stable milestone. H9/H11 remain pending.

```bash
node --test --test-isolation=none packages/sdk/test/storage-failures.test.ts packages/sdk/test/ownership.test.ts
node evals/sdk/ownership-faults.ts
npm run typecheck
npm run release:prepare
node --test evals/packaging/packed-sdk.test.ts
node evals/packaging/faults.ts
npm test
npm run test:coverage -- --serial
```

The preceding component is locally committed with a verified bundle and exact
clean clone/full integrity check. Clean close passes nine of ten, with only
intentionally unpushed HEAD failing. All work remains local; no push.
