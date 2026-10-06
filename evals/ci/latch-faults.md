# Maintained ADR-012 fault gate — partial CI-1

Measured 2026-10-05, Node 26.7.0, Keel 1.0.1. Builder-authored evidence.
Starting implementation revision `f16938c`; runner revision is the commit containing this receipt.
Original failing-first tests and manual planted faults: `evals/sdk/latch-c.md`.

Regenerate: `npm run test:latch:faults`. The runner requires a passing baseline, then applies
each previously demonstrated fault individually to the guard source. It requires exit 1,
all 24 tests to have run, and an assertion failure; parser/setup errors cannot count.
Original bytes are restored in `finally` after each fault, and the restored source must pass.
CI executes this sequentially after the normal tests on the approved runtime matrix.

```text
caught latch fault: v0
caught latch fault: only-keel
caught latch fault: only-previous
caught latch fault: last-entry
caught latch fault: no-replay-predecessor
caught latch fault: no-denial-threshold
caught latch fault: skip-intervening-decision
All latch faults caught; restored source passes
```

All seven faults caught. No threshold or coefficient changed. This implements the latch
portion of CI-1; injections for all other existing gates and CI-2's full qualification
programme remain outstanding. Concurrent source mutation is unsupported.
