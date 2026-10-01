# CI, the safety net: shown failing, then passing

Milestone 2a.1 in [docs/ROADMAP.md](../../docs/ROADMAP.md). The workflow is
[.github/workflows/ci.yml](../../.github/workflows/ci.yml). It runs four gates on every push and pull request:

| Job | Gate |
|---|---|
| guard tests and typecheck | `npm test`; `npm run typecheck` |
| knowledge vault and write boundary | `tools/kb_lint.py`; `tools/boundary_guard.py --selftest` |

Later steps run even when an earlier one fails, so one push reports every gate it breaks. The actions are pinned to
full commit SHAs, and the workflow's token can only read.

## 1. Four faults, one per gate

Injected on a throwaway branch, `ci/fault-injection` (commit `832643a`), in a worktree outside the repository. The
branch was never merged and was deleted after the run.

| Gate | Fault |
|---|---|
| `npm test` | the destination check removed from `checkPolicy` |
| typecheck | `export const injectedFault: number = "one SOL" as string;` |
| `kb_lint` | a link to `nowhere.md` appended to `kb/wiki/glossary.md` |
| boundary self-test | the `intake-drop` rule deleted from `boundaries.toml` |

Run [36798182720](https://github.com/dushyants4/solanaut/actions/runs/36798182720), 2026-10-01 00:50 UTC: **both jobs
failed, each gate for its own fault.**

```
npm test             ✖ a transfer to a destination off the allowlist is denied, whatever came before it
npm run typecheck    packages/sdk/src/policy.ts(67,14): error TS2322: Type 'string' is not assignable to type 'number'.
kb_lint              [FAIL]  kb/wiki/glossary.md: broken link → nowhere.md
                     151 markdown files, 74 kb notes; 1 error(s), 0 warning(s)
boundary self-test   [FAIL]  allow  write into the intake drop (read-only, byte for byte)
                     33/34 cases passed
```

## 2. Then passing

Run [36798239392](https://github.com/dushyants4/solanaut/actions/runs/36798239392), on `main` at `48c8c37`: both jobs
green.

```
ℹ tests 9   ℹ pass 9   ℹ fail 0
151 markdown files, 74 kb notes; 0 error(s), 0 warning(s)
34/34 cases passed
```

## 3. What the boundary self-test proves in CI, and what it does not

`boundary_guard.py` refuses a policy written for another host: the hostname must match, and every protected path must
exist. A fresh runner is another host, so the guard fails closed there. `tools/ci_host_fixture.py` reshapes the
runner from `boundaries.toml` itself: it sets the hostname, creates every protected path as an empty fixture, and
copies the checkout to the policy's root. It refuses to run anywhere but GitHub Actions.

- **Proved in CI:** the guard's decisions, case by case, against the committed policy.
- **Not proved in CI:** the host binding itself. That is checked only on the real host, by
  `tools/session_close.py` (gate 3).

## Regenerate

- Push any commit; the workflow runs.
- To repeat the fault matrix: branch, apply the four faults above, push, and check that each gate fails for its own
  reason. Delete the branch afterwards.
