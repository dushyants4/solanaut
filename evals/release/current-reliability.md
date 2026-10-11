# CI-2 — current SDK recovery and admission qualification

2026-10-11 Toronto, revision fd5ec6ef6bd38acc8907626b2b09554191b03d8a,
unchanged integrated D40 product, Linux/Node 26.7.0. Builder-authored local
SDK evidence, not independent review or isolated deployment qualification.

Freeze current source and the original kill/admission workload and fixture
identities before execution. Retain original domains, seeds, target counts,
validator checks and child deadlines. No source, threshold or gate changes.

The maintained kill workload completes all 100 acknowledged-prefix SIGKILL
trials, restores each persisted state, completes its original workload and
replays every resulting history. All 100 recoveries and 100 replays pass.
The log records each original kill point and scratch journal path. This
does not cover unacknowledged writes, signing/send boundaries, power loss,
isolated users or bounded restart memory.

The original shared-barrier admission workload completes 1,000 proposals with
distinct destinations/identities: seven admitted and 993 denied by over-window-cap.
All 1,000 decisions are recorded and 7,000,000 lamports remain reserved. This is
same-event-loop contention at a synchronous in-memory SDK API, not concurrent
threads, separate writers, socket capacity or isolated signer qualification.

Eight existing maintained validator controls pass without skips/cancels/todo;
they include short/incomplete evidence refusal and killed kernel-owner recovery.
Earlier original planted-fault receipts remain unchanged in `evals/ci/kills.md`
and `evals/ci/concurrency.md`. No new product mutation credit is claimed here.
Every bound source/fixture hash still matches after execution; all three owned
jobs exit zero and no worker remains. Typecheck passes.

```sh
node --test evals/ci/kills.test.ts evals/ci/concurrency.test.ts
node --input-type=module -e 'import {measureAdmissions,validateAdmissions} from "./evals/ci/concurrency.ts";const r=await measureAdmissions();console.log(JSON.stringify(r));validateAdmissions(r);'
npm run test:kills
npm run typecheck
```

Complete raw logs, source/revision/runtime pins and owned process identities
are retained in `current-reliability/`. Earlier H11/native/coverage/maintained
failures remain visible. This does not establish full CI, other runtimes,
performance, independent security, live chain correctness or a stable milestone.
