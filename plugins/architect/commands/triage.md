---
description: Route an incoming request to the right seat, tier and workflow — or out of the Office entirely.
argument-hint: [the request, in the requester's own words]
---

Run `workflows/triage.md` against this request:

$ARGUMENTS

Work through it in order and do not skip step 1.

1. **Is this Solanaut's work at all?** Solanaut builds and ships one product. Anything that
   is not code, tests, docs, releases or the demo (a legal entity, funding terms, licensing,
   posting in public, or anything inside the Gubernaut workspace) goes to the human.
   **Routing out is a complete answer**: say whose it is, say why, and stop.
2. **Which seat?** A seat is defined by its write boundary, not its subject. Ask what this
   request will *write*, and the seat follows from that.
3. **Which tier?** T0 read, T1 docs and drafts, T2 product code, T3 the public API and
   the gate scripts, T4 anything public, on mainnet, or with real funds. **T3 needs the gate shown failing on an
   injected fault first. T4 is the human's.**
4. **Which workflow?** `new_project`, `harness_audit`, `eval_battery`, `sdk_release`, or
   none of them — in which case say so rather than forcing a fit.

Report: the seat, the tier, the workflow, and anything that needs the human before work
starts. If the request needs a write to a repo not listed in `CLAUDE.md`, say that first,
not last.
