# Policy v1: shown failing, then passing

Milestone 2a.4 in [docs/ROADMAP.md](../../docs/ROADMAP.md): policy v1, validated when it is created (rule 0), frozen all
the way down, and hashed; the principal; pinned lookup tables ([docs/SPEC.md](../../docs/SPEC.md) §3 and §5). Run on
2026-10-01 with Node 26.7.0.

| File | What it is |
|---|---|
| `packages/sdk/src/policy-v1.ts` | `createPolicy(input)` returns `{ policy, hash }` or throws a `PolicyError` listing every problem; `contextOf(policy)` feeds the classifier |
| `packages/sdk/test/policy.test.ts` | 13 tests |

**Defects D1, D2 and D9 are fixed in policy v1.** Today's guard (`guard.ts`) still takes the old `Policy` from
`policy.ts`. They close in the guard at milestone 2a.5, when admission takes policy v1 and the old shape is retired.
[docs/SPEC.md](../../docs/SPEC.md) §10 records them that way.

## 1. Failing first

The first 12 tests ran against a stub whose functions threw `not implemented`. The typecheck was clean.

```
ℹ tests 12   ℹ pass 0   ℹ fail 12
```

The first full run failed one test, in the test's own failure label: `JSON.stringify` cannot serialize a bigint. The
label was fixed; the implementation was not involved.

## 2. Then passing

```
✔ a valid policy loads, with amounts as bigint and a 64-hex hash
✔ the hash depends on content only: key order and amount spelling do not change it; any value does
✔ the hash is SHA-256 of canonical JSON: sorted keys, no whitespace, amounts as decimal strings
✔ D1: the policy is a frozen copy; neither the caller's object nor the returned one can widen it
✔ D2: a cap that is not a whole, non-negative amount is refused, never read as no cap
✔ D9: amounts past 2^53 are exact
✔ rule 0: addresses must be canonical base58 keys, and the principal must hold one
✔ rule 0: the latch's release key is never a principal key, so the agent cannot release its own latch
✔ rule 0: one entry per mint and per table, a known token program, and a known cluster
✔ rule 0: counts and durations are positive whole numbers; the guard id fits on one line
✔ rule 0: v1 never signs messages or co-signs, and refuses any field it does not know
✔ every problem is reported at once, so an operator fixes them in one pass
✔ the classifier's context comes from the policy
ℹ tests 13   ℹ pass 13   ℹ fail 0
```

## 3. Eight planted bugs: seven caught at first, then all eight

| Planted bug | Failing tests |
|---|---|
| JS numbers accepted as amounts (D9) | 1 |
| negative amounts accepted (D2) | 1 |
| only the top level frozen (D1) | 1 |
| the caller's arrays kept instead of copied (D1) | 1 |
| the agent's own key accepted as the latch's release key | 1 |
| unknown fields ignored, so a misspelt cap would be silently dropped | 1 |
| a newline allowed in the guard id, which goes into the signed release message | 1 |
| the hash taken over plain JSON in insertion order, not canonical JSON | **0 at first** |

**The last bug survived.** `createPolicy` rebuilds the policy field by field in a fixed order, so the key-order test
could never tell canonical JSON from plain JSON. The spec defines the hash as SHA-256 of canonical JSON, because
another implementation, such as the dashboard or a replay tool, must be able to recompute it. A known-answer test now
pins it. The expected digest was computed outside this codebase, by Python's
`json.dumps(policy, sort_keys=True, separators=(",", ":"))`:

```
8df52fd7623cdd1a19226200df07b4003b2f427d295eb2748d0f2b548840caf4
```

With that test in place, the eighth bug fails one test.

## Regenerate

- `node --test packages/sdk/test/policy.test.ts`
