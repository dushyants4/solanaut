# Combined owner-entry proposal qualification

Builder-authored local evidence, 2026-10-10 Toronto, Linux/Node 26.7.0.
Reviewed base e16c9df4a54ba0adf6b8d07c0dd1d86ab9b4c890; product remains
f1e253f. Apply the exact O2 and O3 drafts to generated scratch copies only.
Original gate and prototype hashes are checked before and after execution.
Only root/import/output/scratch paths and reviewed-base metadata change;
baseline stdout/stderr is archived with one additional write before its original
assertion. No maintained source, declaration, case or process limit changes.

The original extra baseline rejects a copied candidate whose replay CLI shebang
is removed. All nineteen cases finish: seventeen pass and two fail, with no
cancelled/skipped/todo cases. Entry status is one at the original baseline
assertion; no fault worker starts. Preserve this initial negative result rather
than treating its failure as a successful campaign.

The healthy generated entry passes its original nineteen-case baseline, then
catches all 144 original faults with all nineteen installed cases per trial.
Eight initial/restored worker controls pass. No setup, timeout or incomplete
trial receives fault credit. Cache is disabled and the original staged bytes
and modes are unchanged. The outer observer retains 300,000 ms and records
254,956.188588 ms, status zero, no signal/error. Execution time is not guard
performance or a comparison with earlier runs.

```bash
uv run --script evals/packaging/parallel-entry.py --baseline-fault # expected red
uv run --script evals/packaging/parallel-entry.py
```

Raw entry logs are `parallel-entry-red.txt` and `parallel-entry-full.txt`.
Generation, baseline, every worker/fault log, summary and termination are in
`parallel-entry/`. S114's ignored-signal and false-completion probes remain
separate evidence. This nominal full-entry pass does not establish universal
termination, orphan recovery, power-loss durability or protection against an
unresponsive original synchronous baseline child.

Owner application and exact maintained-source/inventory qualification remain
owed. Actual maintained gates are unchanged and their S110/H11 failure remains.
This is proposed integration evidence, not hosted CI, independent security,
milestone completion, publication clearance or stable-release qualification.
