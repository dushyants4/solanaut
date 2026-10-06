# POLICIES.md — signing and verifying policy history

> **Draft 1** · 2026-10-05 · owner: integrator · for: SDK users and operator-tool developers.
> This foundation is tested offline; isolated deployment and Phantom rehearsals are still owed.
> Evidence: `evals/sdk/signed-policy.md`, claim S15. Register: `kb/DOCUMENTS.md`.

Prepare the exact text with `preparePolicyText(policy, version, issued)`. The authorization
version is a positive integer separate from the policy schema's `version: 1`; `issued` is the
UTC timestamp from `new Date().toISOString()`. The helper validates policy content and derives
the readable summary. Review the complete policy as well as its summary, then have the pinned
operator sign those exact UTF-8 bytes with Phantom's `signMessage`.

The `authorization` passed to `createGuard` contains:

```typescript
{
  operatorKey, guardId, cluster, // pinned independently of the policy
  version, issued, text,
  signature                    // canonical base64 of the operator signature
}
```

Set `latch.releaseKey` to that operator key. It must be outside the principal. An edited policy,
identity substitution, incorrect signature or dishonest summary refuses startup. Keep the
configuration and policy files outside the agent's write permissions. Signed mode fixes sensor
v1; injecting a different sensor cannot claim the same evaluation profile.

The existing unsigned SDK mode remains trusted and advisory. A process that can reach its own
key can bypass the SDK. It is not the isolated signer product. Once a record contains signed
policy history, opening it without the external pin is refused.

A policy changes through a restart with a newly signed higher version. Windows, pending attempts,
used receipts and the latch survive. Restarting the identical version/text adds no duplicate policy
entry. Reverting policy content also requires a higher version; restoring an older policy file is
refused. No live policy socket method exists.

For a signed record, make a public trust JSON file containing only `operatorKey`, `guardId` and
`cluster`, then use:

```bash
npm run replay -- <record.jsonl> - <public-trust.json>
```

The hyphen selects policies recorded in history. The installed command is `solanaut-replay`
with the same arguments. Ordinary legacy records still accept `<record.jsonl> <policy.json>`.
Use `replay(entries, undefined, undefined, trust)` or `inspectRecord(entries, policy, trust)`
in the SDK. Replay names the first divergence; missing trust or unsupported history never counts
as successful replay.

`PolicyAuthorizationError` has code `policy-authorization`; correct the external pin or prepare
a valid higher signed version. `PolicyError` still reports invalid policy fields. Unsupported
evaluation profiles need a compatible binary; changing a profile label is not an upgrade.
