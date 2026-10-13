# ADR-025 · Denial reasons go to the operator, not the agent

**Status: accepted by the human on 2026-10-13.** Drafted by Claude (architect) from the human's direction of the same
day. It changes the contract of `SolanautDenied` in `docs/SPEC.md` §8, so that edit, with the class table, comes before
the code.

## Context

- **Today a refusal tells the agent exactly why.**
  - `SolanautDenied` carries `{ rule, reason, decision }`, and its message is `rule: reason`.
  - SPEC §8 says "a denied agent gets a named rule to act on".
  - An LLM agent reads that text as the result of its tool call.
- **The human, 2026-10-13:**
  - An agent that knows why it was refused may try to correct the request or get around the rule, because its harness
    pushes it to make the transaction succeed however it can.
  - So the reason should go to a separate interface, outside the agent's pipeline, where the user can see it.
- **That is right.** The policy holds whatever the agent knows. But a precise reason is a map of the fence:
  - "not in the destinations" invites routing through an address that is allowed;
  - "0.3 SOL left in this window" invites splitting the payment;
  - "program not allowed" invites another program that does the same job.

  Each refusal becomes a step in a search. The fooled agent of the README's first example would be shown where to push.
- **Some feedback is still owed.** A benign agent needs to know whether to wait or to stop. A developer needs the full
  reason while building.

## Decision

1. **Two channels.**
   - **The agent's channel** carries three things:
     - the verdict;
     - a reference, the decision's sequence number in the record;
     - one class out of three:
       - `refused`: a rule the operator set said no. That covers programs, destinations, mints, caps, fees, token
         settings, the latch, Keel's loop brake and ADR-024's failure budget. Do not retry.
       - `retry-later`: a passing cause. The blockhash expired, the RPC is unavailable, or an earlier attempt with the
         same effects could still land.
       - `invalid`: the proposal cannot be decoded or is malformed.

     It never carries the rule's name or number, a limit, a remaining allowance, an address, an amount, or any text
     taken from the policy.
   - **The operator's channel** carries everything: the rule, the reason and the decision.
     - The record already holds all of it.
     - In SDK mode, an `onRefusal` callback passed to `createGuard` delivers each refusal to the developer's own log
       or alert, outside the model's context.
     - The cockpit shows each refusal with its reason.
     - In signer mode (3.1), the agent's socket returns only the agent's channel. The reasons go to the record and to
       the operator's alerts (3.8).
2. **The operator chooses, in the signed policy.** `disclosure: "class"` is the default. `"full"` is for development: it
   also returns the rule and the reason to the agent. Every decision made under `"full"` says so in the record, and the
   cockpit shows it.
3. **Unchanged:** the rules, their order, every decision, the record, receipts and replay. Only what the agent is told
   changes.
4. **The limits, stated plainly.**
   - In SDK mode the guard runs inside the agent's process, so this hides reasons from the model, not from code running
     beside it (RK3). In signer mode, the agent's socket never carries them.
   - An agent can still learn by trial and error. Each probe is a proposal, so repetition feeds Keel's brake, and a
     run of denials latches the guard (ADR-012). This ADR claims nothing about stopping inference.

## Consequences

- **The API.**
  - The agent-facing `SolanautDenied` carries `{ ref, class }`, and its message reads like `refused (decision 1234)`.
  - The full decision moves to the operator's side: `onRefusal`, the record and the cockpit.
  - `onRefusal` runs after the decision is recorded. An error inside it is caught and recorded, and never changes a
    decision.
  - The SDK is unpublished, so no outside consumer breaks.
  - Several documents change with it:
    - SPEC §8 and `docs/SDK.md`;
    - the README's "Every refusal names the rule that made it", which becomes "names it to the operator";
    - the demo, whose printed reasons now come from the operator's view.

  ROADMAP 5.2's error catalogue is written for operators and developers.
- **The class table.** Each rule's class is set in a frozen table in SPEC §8, before the tests are run. When in doubt, a
  rule's class is `refused`.
- **Tests, seen failing first.**
  - For every rule and every fixture, the agent's error leaks nothing. Its message, `cause`, stack and serialised form
    contain no rule name, and no number or address from the policy.
  - The operator's channel holds the full reason.
  - `onRefusal` fires exactly once per refusal.
  - Decisions made under `"full"` are marked in the record.

  Planted faults: a leaked rule name, a leaked limit, a skipped callback, and `"full"` as the default.
- **The order of work.** Build this before the signer's socket replies are fixed (3.1), so that protocol is built once.
  The SDK's adapters change first.
- **The cost.** Debugging is harder for a developer who forgets `"full"` in development, or never wires `onRefusal`.
  The quickstart and the docs must make both one line.
