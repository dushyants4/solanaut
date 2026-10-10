# Local candidate history inventory

Builder-authored local PUB-1 preparation, 2026-10-10 Toronto, Linux/Node 26.7.0.
Exact reviewed revision f4f3d9282af983908bbd2a7e4f3b5f6212d96795.
The complete local bundle verifies and restores to that clean commit; full Git
integrity verification succeeds. Run the existing unchanged history inspector
against this restored repository rather than changing original harness refs.

```bash
node evals/ci/history-run.ts --repository .sandbox/local-backups/restore-entry-rebuild
```

The restored repository's ten refs and complete reachable closure contain 154
commits, 5,776 distinct historical blobs, 5,086 distinct paths and no gitlinks.
Inventory digest:
`8161ce586ce89d3c5ad106feadc8a4970eb96e5b2e0e69a76c3e9236b71f2419`.
The complete manifest is
`../ci/history/inventory-f4f3d92-8161ce586ce8-1791643374511.json`;
raw summary and unchanged clean status are retained beside it. Actual commit
bodies and hashes are verified by the existing inspector. Blob contents are
not inspected, printed or changed. No human-drop bytes or original refs change.

This is the named restored repository's ref set, not all original harness refs
or the human's final proposed public scope. The bundle separately preserves
the original local refs. Reflogs, unreachable objects and uncommitted files are
excluded explicitly. Earlier origin-mirror inventories retain their original
scope and evidence; this local inventory replaces none of them.

The final public ref set and hosted historical exposure still need settlement.
Every proposed public historical blob needs confidentiality, secret, rights,
licence and third-party-notice review before visibility changes. This inventory
provides no such clearance, independent audit or stable-release evidence.
Later commits require a new inventory; no publication or history rewrite occurs.
