# ADR-014 · The operator signs the policy, and a policy changes only through a restart

**Status:** **accepted** by the human on 2026-10-05, with the Alpha's scope (milestone 2c.1); proposed on 2026-10-01. It answers POL-5 in
[docs/SPEC.md](../docs/SPEC.md) §13.2, and is written before milestone 3.2's code.

## Context

- **The threat.** T11: the policy edited to widen it. The Beta closed the in-process route (D1: a deep-frozen private
  copy, its hash in every decision). A process that can write the policy file before the guard starts can still widen
  it.
- **What is fixed already.**
  - ADR-011 §1: Phantom signs the policy hash, and a guard loads only an operator-signed policy.
  - The latch release is the pattern: a structured UTF-8 text that Phantom's `signMessage` signs, checked with ed25519
    (SPEC §7).
  - A record already outlives a policy change: restore applies it under the current policy, and `replay` under the
    old one explains the old decisions (SPEC §7).
- **What is open.**
  - Which key is trusted to sign, given that the policy itself names the release key.
  - What the operator actually sees in Phantom before signing.
  - How a signed policy replaces the running one.
  - How replay learns which policy made each decision.

## Options

**How a new policy takes effect:**

| | Mechanism | Cost |
|---|---|---|
| A | restart the signer with the new signed policy | a few seconds without a guard |
| B | a new socket method, `policy`, that swaps it live | a fourth method, against SIG-2's three, and a swap racing a proposal |
| C | watch the policy file | the same race, and a file the agent may reach |

**What the operator signs:**

| | Text | The operator sees |
|---|---|---|
| 1 | the policy's hash only | 64 hex digits, so in effect signs blind |
| 2 | the hash and a short summary the signer derives from the policy | the destinations, the caps and the programs, as well as the hash that binds them |

## Decision (accepted 2026-10-05)

**A with 2.**

1. **The trusted key is pinned outside the policy.**
   - The signer's own configuration names the operator's public key. It is owned by the signer's user (ADR-013), so the
     agent cannot reach it.
   - A policy's `latch.releaseKey` must equal that key. Otherwise rule 0 refuses it.
2. **What is signed.** This UTF-8 text, which Phantom's `signMessage` can sign:

   ```
   solanaut policy
   guard: <latch.guardId>
   cluster: <latch.cluster>
   version: <a positive integer>
   policy: <policyHash>
   issued: <ISO 8601 time>
   destinations: <count>, <first two, then "and N more">
   SOL: <maxPerTx> per transaction, <maxPerWindow> per <windowMs as minutes or hours>
   tokens: <count of listed mints>
   programs: <count>; opaque: <deny|allow>
   ```

   The signer derives the summary lines from the policy itself, and refuses a text whose summary differs. So the lines
   the operator reads are bound to the hash they sign.
3. **Refused at start, with no guard:**
   - no signature, or a wrong key;
   - another guard or cluster;
   - a hash that does not match;
   - a version lower than the highest the record holds, which stops a rollback to a looser, older policy.
4. **A change is a restart.**
   - The operator signs a new version, and the signer restarts with it.
   - On start, the signer appends a `policy` entry holding the canonical policy, its text and the signature, then
     restores under it. Windows, intents, receipts and the latch carry over, as now (SPEC §7).
   - The latch is a recorded fact, so a new policy cannot release it.
5. **Replay reads the policy from the record.** It applies each `policy` entry in turn, so a record replays on its own,
   as its decisions' bytes already let it.
6. **SDK mode verifies too, and says what that is worth.** In SDK mode the agent's process can still edit memory, so
   the check is recorded as advisory (T11, SDK mode).

## Consequences

- **What it stops.** A policy file widened by anything but the operator's key, and a rollback to an older signed
  policy. T11 moves to "a compromised operator wallet".
- **What it adds to the record.** A `policy` entry kind, the fifth. Records without one replay as now, under the
  policy given to `replay`.
- **Operations.** Each change costs a signature in Phantom and a restart. Policies change rarely, and a few seconds
  without a guard denies nothing that was allowed, because nothing is signed meanwhile.
- **The dashboard.** Dashboard v1 (3.8) shows the policy version and its summary, and prepares the text for the
  operator to sign.
- **Not decided here:**
  - presets for policies (T16), part of the developer experience (Leg 5);
  - several operators signing (a threshold), which is an autonomous multisig's job (ADR-011 §6).
