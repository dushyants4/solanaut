# ADR-013 · The signer process: its user, its socket, and what it trusts

**Status:** **proposed** on 2026-10-01, for the human to accept at milestone 2c.1. It answers SIG-10 in
[docs/SPEC.md](../docs/SPEC.md) §13.1, and is written before milestone 3.1's code.

## Context

- **What SDK mode cannot do.** In the Beta, the guard and the key share the agent's process. Code in that process can
  call the key directly (T9), and the caller supplies time, heights and outcomes (T20, T21). SPEC §2.1 states it: the
  SDK mode stops a fooled model, not a compromised process.
- **What the signer is for.** Milestone 3.1 moves the key into `solanaut-signer`, which stamps time and fetches
  heights, blockhash validity, outcomes and unpinned tables itself. SPEC §8 already fixes its surface:
  - `propose`, `report` and `status` over a Unix socket, and nothing else;
  - a deadline of 30 s or less, and an ID, on every request;
  - 500 lines or fewer.
- **What is open.** Under which OS user it runs, how the agent reaches it, who sends what it signs, what an agent's
  `report` may change, and how a retried request is recognised after a restart.
- **What devnet taught.**
  - Solana Agent Kit reports landed payments as failed (M13), so an agent's word on an outcome is not evidence.
  - The public RPC rate-limits per method, so reads must back off, and sends must never retry.

## Options

**Where the key lives:**

| | Key and guard | Stops code in the agent's process? | Cost |
|---|---|---|---|
| A | a child process of the agent, over stdio | no: the same user can read its memory and its key file | none |
| B | a separate process under the **same OS user** | only an agent that does not look: the user can read the key file | low |
| C | a separate process under **its own OS user**, its key file readable only by that user | yes, short of a root or signer-host compromise | a second user to set up |

**How the agent reaches it:**

| | Transport | Who can connect |
|---|---|---|
| 1 | HTTP on 127.0.0.1 | any local process of any user, and a browser through DNS rebinding |
| 2 | a Unix socket in a directory only the signer's user and the agent's group can enter | the agent's group; the kernel enforces it |
| 3 | gRPC | as 1 or 2, with a code generator and more lines than the 500 budgeted |

## Decision (proposed)

**C with 2: its own OS user, and a Unix socket guarded by directory permissions.**

1. **The user.**
   - The signer runs as `solanaut-signer`. Its key file is mode 0400, owned by that user.
   - The socket lives in a directory of mode 0750, owned by the signer and the group `solanaut`. The agent's user is a
     member of that group and nothing else.
   - Node has no portable peer-credential check, so the directory is the boundary, enforced by the kernel.
2. **Same-user mode exists, and says so.** For a laptop demo, `--same-user` runs option B. Then `status` reports it,
   every decision records it, and the dashboard shows it, because T9 is then not stopped.
3. **The signer sends what it signs.**
   - `propose` takes the message bytes and an optional grouping key, and answers in one step: denied by a named rule,
     or signed, sent and returned with its signature.
   - It is the `guardedWallet` path of the Beta (§8), moved behind the socket, so nothing a wallet adds goes out.
4. **Outcomes come from the chain, not the agent.**
   - The signer follows every attempt it signed until it lands, fails or expires, reading the height before the status
     (D14).
   - An agent's `report` is a hint: it makes the signer read that attempt's status now. It is never recorded as an
     outcome.
5. **Requests are idempotent across restarts.**
   - Each request carries a client ID and a deadline, which is refused if it is more than 30 s ahead or already past.
   - The decision entry records the request ID. A retried ID returns the recorded answer, even after a restart, and
     signs nothing twice.
6. **What it trusts.**
   - Time: a monotonic clock, anchored to wall time once at start, with the anchor recorded.
   - Heights and statuses: the operator's RPC at `confirmed`.
   - Lookup tables that are not pinned: read at `finalized`, with what was read recorded (SIG-5).
   - Any RPC failure denies a proposal. Follow-ups retry with backoff, and sends never retry.
7. **The size budget.** 500 lines or fewer, excluding the SDK it calls. Measured in 3.1's receipt.

## Consequences

- **What it stops.** Code in the agent's process can no longer reach the key, or lie about time, heights or outcomes.
  T9, T20 and T21 move from "the SDK mode, stated" to "a compromised signer host" or "a root compromise".
- **What it adds to the record.** A `request` field on decisions, the clock's anchor, the deployment mode, and the
  tables read. These are additions, so records of entry format `v: 1` still replay.
- **The adapters keep working.** `guardedWallet` and `guardedSigner` gain a signer-mode transport: same verdicts, same
  `SolanautDenied`.
- **Operations.** Setting up a second OS user is a step the README must walk through. That cost is accepted for a
  guard whose point is that the agent cannot reach the key.
- **Not decided here:**
  - production custody (a KMS or HSM, a remote signer, or Phantom's key service), due before R.4
    (`docs/READINESS.md`);
  - escalation to the operator (PHX-1), which is milestone 3.5's.
