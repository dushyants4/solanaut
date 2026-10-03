# The independent evaluator run

Milestone 2b.1 asks for the Beta batteries to be run by the evaluator seat. The session that built the code ran them
against stubs and planted faults; this harness gets an evaluator that did not build the code, given only the spec.

## How it runs

1. `bash evals/independent/setup.sh <name> …` builds one folder per evaluator in `~/.cache/solanaut/eval/`, outside
   the repository, where a reboot does not clear it. Each folder holds:
   - `SPEC.md`, a copy of `docs/SPEC.md`;
   - `API.md`, the SDK's exported declarations with every function body removed (`make_api.py`);
   - `node_modules`, a link to the installed packages, so `import … from "@solanaut/sdk"` works;
   - an empty `tests/`.
2. Each evaluator gets one area, the shared rules and the hand-back format:
   - **The rules:** a black box (read only `SPEC.md`, `API.md` and its own files); write only in its folder; one test
     per case, with the expected result derived from the spec's text; a failing test is a finding, not a fix; an
     ambiguity is recorded as `unclear`.
   - **The hand-back:** `REPORT.json` (cases with spec, input, expected, observed, verdict) and `REPORT.md`, with every
     failure and its minimal reproduction first.
3. `python3 evals/independent/audit.py <folder> <transcript.jsonl>` reads the evaluator's own tool calls, never its
   tool results, and flags any read of the repository or of `node_modules/@solanaut`, and any write outside its folder.
   A report with an unexplained hit is not independent. `--selftest` plants four hits and five allowed calls.
4. Each failure is then triaged: a defect in the code, an error in the test, or a gap in the spec. A defect is fixed
   test-first, with the evaluator's case as the failing test.

## The Beta's run, 2026-10-01 to 2026-10-03

| Evaluator | Area |
|---|---|
| e1-decode | decoding and classification: §3, §4, rules 0 to 13; the fail-closed and drain batteries |
| e2-state | the guard's state: §7 entire, rules 4 and 14 to 16; the double-send, concurrency, restart and latch batteries |
| e3-edges | the adapters and Keel: §6, §8, rules 17 to 19, D3, D4, D13, D14; the adapters, loop and benign batteries |

The evaluators are this session's subagents (the same model family as the builder, with separate contexts).
Outside agent CLIs were refused when run unattended (`runs/2026-10-01-devnet.md`).

**What went wrong on the way:**
- All three first ran in parallel, and were cut off together by the account's usage limit.
- A reboot then cleared their folders, which were in `/tmp`. The folders now live in `~/.cache/solanaut/eval/`.
- The evaluators were resumed one at a time, each writing its report as it went.
