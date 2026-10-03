# REPORT.md: evaluator E1, decoding and classification

> Written by the evaluator (a subagent given only `SPEC.md` and `API.md`) and saved here verbatim from its hand-back:
> its harness refused it the write. The triage is in [TRIAGE.md](TRIAGE.md), kept apart.

**Area:** §3 `EffectsV1`, §4, §5 rules 0–13, §11 fail-closed and drain batteries. SPEC Draft 4, unchanged in this area.

**Result:** 151 cases: **141 pass, 1 fail, 9 unclear.** Every decision the cases check matched the spec. That covers each instruction named in §4's table, each "decided while building" item, nine rule-order pairs, rule 0, the fee formula and its boundaries, and all twelve drain kinds in §11. The evaluator went past the brief's 30–45 cases because the first 45 all passed, and the brief's own lists need more.

**Method:**
- Run: `node --test tests/*.test.mjs` in /home/dashy/.cache/solanaut/eval/e1-decode.
- Legacy, v0 and v1 messages built byte by byte. v1 follows @solana/kit 8.4.0's codec, checked against kit's decoder.
- ATAs come from kit, not the SDK.
- A neutral sensor held Keel at DEFAULT, so rules 17–18 could not decide these cases.

## Fail

**S02 · §3 intentKey does not match its stated formula** (tests/exact.test.mjs).

- **Setup:** base policy in tests/lib.mjs; a legacy message where A pays and one System Transfer moves 1000 lamports from A to B.
- **Reproduction:**
  ```js
  const e = effectsOf(msg, contextOf(createPolicy(policy).policy));
  const canon = `{"feePayer":"${A}","nonce":false,"opaque":[],"signers":["${A}"],"sol":[{"from":"${A}","kind":"transfer","lamports":"1000","to":"${B}"}],"tokens":[]}`;
  sha256hex(canon) === e.intentKey   // false
  ```
- **What else was tried:** all 32,767 subsets of the 15 `EffectsV1` fields (bigints as strings or numbers), plus `v:1`, `version:1`, a trailing newline, an ordered array and pretty JSON. None match (probe-intent.mjs).
- The key is stable across calls, and still behaves as §4 says (F16, F17, X11), so nothing is admitted wrongly. Either the spec's formula or the code should change, so a replayer can compute the key from the spec alone.

## Unclear (each denied or bounded on the safe side)

| Case | Question | Observed |
|---|---|---|
| X10 | §4: is "the mint's token program" the one the policy lists, or the one the instruction runs under? | `mint-not-allowed`; the other reading gives `destination-not-allowed` |
| U01 | §5 rules 10/11: plain Transfer from a non-ATA source into an allowed owner's ATA, mint unknown — which rule? | `destination-not-allowed` |
| U02 | §4: does "at most 1,400,000" cap an explicit limit? | capped |
| U03 | Must decoded programs (Memo, ComputeBudget) be on `programs.allow`? | `program-not-allowed` when absent |
| U04 | Duplicate static key | `malformed-proposal` |
| U05 | A principal paying itself | `destination-not-allowed` |
| U06 | `at = NaN` | `malformed-proposal` |
| U07 | Numeric `intent` | `malformed-proposal`; also a 256-character bound the spec doesn't state |
| U08 | Header read-only counts larger than the key list | `malformed-proposal` |

Rule 0's "a release key that is the fee payer" can't be tested as written: PolicyV1 has no fee-payer field.

## My own changes to tests
- X10 first asserted `destination-not-allowed` from one reading; it now asserts only the denial.
- `node --test tests/` doesn't run in Node 26; the suite uses the glob.
- Files were recreated after the reboot.

## Last lines of `node --test tests/*.test.mjs`

The summary reads: tests 151, pass 150 (includes the 9 unclear), fail 1, cancelled 0, skipped 0. Node then reprints the failure:

```
      at TestContext.<anonymous> (file:///home/dashy/.cache/solanaut/eval/e1-decode/tests/exact.test.mjs:31:10)
      at Test.runInAsyncScope (node:async_hooks:226:14)
      at Test.run (node:internal/test_runner/test:1397:25)
      at Test.processPendingSubtests (node:internal/test_runner/test:969:18)
      at Test.postRun (node:internal/test_runner/test:1537:19)
      at Test.run (node:internal/test_runner/test:1462:12)
      at async startSubtestAfterBootstrap (node:internal/test_runner/harness:387:3) {
    generatedMessage: true,
    code: 'ERR_ASSERTION',
    actual: '7a80c608f8e57bdc4be3e862909e9692c74ffee61b68402d4010da511d0af315',
    expected: 'a6a0098d77705fb7cf1df9dc5210464b25249e40517950daf006aa0d4cd18bac',
    operator: 'strictEqual',
    diff: 'simple'
  }
```
