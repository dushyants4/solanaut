# Maintained fault job — CI-1, partial

Measured locally 2026-10-06, Node 26.7.0, Keel 1.0.1/sensor v1. Revision: commit
containing this receipt (`git log -- evals/ci/bite.md`). Builder-authored gate evidence,
not independent security qualification. Existing historical reports remain unchanged.

Three aggregation tests fail against the stub (`bite/red.txt`), then pass
(`bite/green.txt`). The first full fifteen-campaign run fails on the stale request-identity
selector (`bite/initial-campaigns.txt`). It continues later campaigns and returns nonzero;
source is restored. Repair targets only the existing digest comparison, keeping the new
cross-method namespace check. No product assertion changed.

The final inventory includes the aggregator's own maintained faults. `npm run test:bite`
runs sixteen campaigns sequentially, catches 105 faults and returns
`{"ok":true,"failed":[],"skipped":[]}` (`bite/campaigns.txt`). Regenerate the caught count
with `rg -c '^caught ' evals/ci/bite/campaigns.txt`. Inventory omission/addition/duplication
fails before running. Nonzero/null/throwing campaigns fail aggregation; other campaigns
continue only while source matches the original fingerprint. Changed product or evaluation
source stops further mutations and explicitly lists skipped work.

`node evals/ci/bite-faults.ts` catches five faults: omitted campaign, ignored failure,
ignored restoration, invented clean result and skipped first campaign (`bite/faults.txt`).
No miss in this final campaign. Each runner restores and rechecks its battery.
`npm test`: 329 pass (`bite/full.txt`); `npm run typecheck`: zero. No new dependency.

CI adds a pinned Node 26.7.0 `bite` job on Ubuntu 24.04. It prepares the private candidate
and offline runtime metadata, then runs the same sequential command. Actual run evidence
is recorded in HANDOFF/run record after push. The normal tests/installed checks retain the
approved runtime matrix. Existing package/latch matrix injections remain enabled.

## Still owed

This is all currently maintained executable campaigns, not all historical manual faults
or every future gate. CI-1 remains partial until those maintained regressions are complete.
CI-2's coverage/critical branch floors, tool mutation score, properties, million-input fuzz,
real transaction differential, full replay/kill/concurrency/performance qualification remain
owed. A hand-planted fault count is never a tool mutation score. SIG-11/H9 and outside-user,
independent security, audit, deployment and publication gates remain open.
