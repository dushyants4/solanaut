# ADR-022 · Anchor enrolment and authority rotation

**Status: accepted by the human on 2026-10-13** (proposed 2026-10-06; `docs/HANDOFF.md` §5, H10). The ANC-1
and ADR-015 edits under *Acceptance and evidence* come first, then the program.
ADR-020 requires operator-authorised enrolment and rotation. ANC-1 and ADR-015 still
specify a program with only `anchor(head, seq)`. Their account contract does not describe
how those distinct ceremonies establish and change the trusted authority.

## Context

A per-guard PDA address does not establish who may first claim that guard's namespace.
An anchor key that simply creates its own account cannot establish the operator's intended
binding. This is a design gap, not an exploit measured against an existing program: the
program is unbuilt. A first-claim rule or implicit reinitialisation would silently choose
a trust contract that the accepted ADRs do not contain.

PDA derivation binds seeds and program identity; signer and stored authority checks are
separate constraints. Sources checked on 2026-10-06:
[Solana PDA documentation](https://solana.com/docs/core/pda),
[Anchor account constraints](https://www.anchor-lang.com/docs/references/account-constraints).
These explain mechanisms, not acceptance of this proposed protocol or a verified build.

## Proposed decision

Use distinct `enrol`, `anchor` and `rotate_authorities` instructions. This explicitly
changes ANC-1's one-instruction contract and needs the human's acceptance. Ordinary
`anchor(head: [u8; 32], seq: u64)` retains its arguments and dedicated anchor authority.

The stable PDA namespace binds the program, the original enrolment operator public key
and a guard identity digest. Specify the digest as SHA-256 of canonical JSON with fields
`domain: "solanaut-anchor-identity-v1"`, `cluster: "devnet"`, `guardId` and
`namespaceOperator`. The current operator may rotate while the original namespace stays
fixed. The operator-owned configuration pins the namespace, guard identity, program and
devnet network identity; an unrelated namespace cannot substitute for this configured PDA.
Cluster text in a seed alone does not authenticate an RPC network.

- `enrol` requires the namespace operator and proposed anchor authority to sign. It creates
  the guard account exactly once and records its identity, operator and anchor authority.
  It records no invented log head. An explicit unanchored state permits the first real
  `anchor` at sequence zero; every later anchor must strictly increase sequence.
- `anchor` requires the stored anchor authority. It cannot initialise an account, change
  authorities or reset sequence. It records the new head/sequence and emits `DecisionAnchored`
  with guard identity. Key separation from the principal is additionally checked by the
  operator/signer configuration, since the anchor program does not read signed SDK policy.
- `rotate_authorities` requires the stored current operator and each proposed successor
  authority to sign. An unchanged operator may be reused when only the anchor key rotates.
  The old anchor key cannot veto repair. Rotation preserves identity, anchoring status,
  sequence and head; it emits the old/new authority binding for audit. There is no close,
  reset or automatic re-enrolment path.

Operator ceremonies are stopped-admission maintenance operations. They are unavailable on
the agent's three-method signer socket. Before resuming, reconcile the on-chain authority
and the signed local maintenance record against operator-owned configuration. Do not adopt
an unexpected on-chain authority merely because the program is configured. RPC and upgrade
authority trust remain explicit residuals; custody and publication gates remain unchanged.

## Alternatives and cost

Retain one instruction and encode enrolment/rotation in optional account combinations.
This keeps ANC-1's surface but combines different authorisation rules in one decoder and
makes an anchor call's effect depend on those combinations. That alternative needs its own
precise accepted account contract before implementation. Doing nothing leaves the existing
gap unresolved and the program unbuilt.

The proposal increases program and client surface, account rent, ceremony work and audit
scope. It requires a versioned account layout and additional negative tests. It grants no
devnet funding, installation, deploy, public visibility, licence or package publication.

## Acceptance and evidence

If accepted, the exact ANC-1 edit is: replace `has one instruction, anchor(head: [u8; 32],
seq: u64), which writes the head to one PDA per guard and emits DecisionAnchored` with
`has operator-authorised enrolment and authority rotation, and anchor(head: [u8; 32],
seq: u64), which writes the head to its configured guard PDA and emits DecisionAnchored`.
Then allocate enrolment/rotation requirement IDs and the exact account/error layout before
building. The present requirement stays unchanged until acceptance.

This also proposes replacing ADR-015 decision §3's seeds (`"anchor"` and the SHA-256 of
`latch.guardId`) with `"anchor"`, the original enrolment operator public key and the
domain-separated identity digest specified above. That accepted PDA decision is not
silently reinterpreted: both the instruction and namespace changes require acceptance.

Prove missing/wrong signatures, foreign namespaces, duplicate enrolment, wrong program,
substituted guard identity, stale/equal sequences, zero-sequence first anchor, rotation with
pending history, stolen old-anchor attempts after rotation and restarted-client pin mismatch.
Compare emitted/head state before and after each ceremony. Run local program tests first,
then the funded devnet programme, verified build and specialist audit. A failure returns to
remediation; no successful-anchoring, outage, verified-build or release gate is waived.
