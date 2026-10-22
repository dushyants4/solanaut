# SIG-11 counted on the formatted code

ADR-021's amendment of 2026-10-22 counts the signer's budget on the code as formatted. This is the
measurement it rests on, taken when the signer was reshaped to the house style.

| | Lines |
|---|---|
| Counted files as written, dense, at `421a118` | 623 |
| The same files formatted, Prettier 3.6.2, `--print-width 120 --trailing-comma all --quote-props preserve` | 1,231 |
| Formatted, with the files' opening comments and one named constant added | 1,260 |
| Ceiling, as amended | 2,000 |

The counted files are unchanged: `apps/signer/src/*.ts` and the SDK's `signing.ts`, `authority.ts`
and `control-request.ts`. General shared SDK code and the agent-side client stay excluded, and no
code was moved.

Regenerate:

```sh
wc -l apps/signer/src/*.ts packages/sdk/src/signing.ts packages/sdk/src/authority.ts packages/sdk/src/control-request.ts
```

Measured 2026-10-22 Toronto, Linux, Node 26.7.0. The reshape changed no behaviour: every string
literal in the counted files is the same, and their fault campaigns were rewritten to the
formatted text and run.
