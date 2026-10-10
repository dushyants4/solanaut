# Current durable-writer crash qualification

Builder-authored local evidence, 2026-10-09 Toronto. Exact implementation
`49f6d6369e58d7f4c6c4f0cbd41705c080f498af`; existing Linux x86-64/Node 26.7.0
host, Btrfs for `.sandbox/` as returned by `stat -f -c '%T' .sandbox`. Do not
reuse the historical ext4 receipt's filesystem scope for this run.
Run the maintained `evals/ci/kills.ts` workload and its unchanged acceptance
checks after the read/write/identity corrections. No source, workload definition,
seed or limit changes for this run. Other qualification workers are stopped.

```bash
npm run test:kills
```

The maintained seed is 202610061. Each trial kills the actual child with SIGKILL
after the specified acknowledged prefix, then kernel-owned recovery completes
the fixed workload and compares every hash with the uninterrupted reference.
Independent recomputation must agree for every recovered trial. Repeated kill
points are possible; do not claim unique transition coverage.

This is process interruption at the existing acknowledgement boundaries, not
random syscall interruption, exhaustive signer/send-boundary coverage, power-loss
durability or independent security. Full Alpha/release reliability remains owed.
All 100 kills, completions and replays pass. Every recovered full record is
byte-identical to the preserved exemplar; trial digests and the frozen input/
environment record are retained, and input hashes match after completion.
Raw output is
`storage-kills-current/hundred.txt`. No remote push, tool installation or funds.

The implementation's local Git bundle, exact clean clone/full integrity check
verify. Clean close passes nine of ten, with only intentionally unpushed HEAD
failing. This is same-machine source-history backup, not an off-device/state/key
recovery qualification.
