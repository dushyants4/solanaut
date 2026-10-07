# Preparing an operator policy signature

> **Draft 1** · 2026-10-06 · owner: integrator · for: Linux operators.
> Register: `kb/DOCUMENTS.md`. Private candidate; the installed signer and human-run
> Phantom workflow remain unfinished.

The policy belongs to the operator. Its principal contains the agent's public keys;
`latch.releaseKey` is the separately controlled operator public key. Amounts in JSON are
decimal strings. Never put private keys in a policy or a signing request.

The read-only preparation command validates the policy and prints a public JSON request:

```bash
solanaut-prepare-policy policy.json --version 2 --issued 2026-10-06T00:00:00.000Z > policy-request.json
```

From the checkout, use `npm run prepare-policy --` with the same arguments. Choose the
intended policy version and actual UTC issuance timestamp; the example does not choose
them for you. A changed policy requires a higher signed version. Reverting content also
needs a higher version, rather than restoring an old policy file. Preparation does not
read current history or establish that your chosen version exceeds the installed one.

Review the guard, devnet cluster, operator public key, policy hash and readable caps and
destinations in `text` against your intended policy. The command also permits localnet for
offline evaluation; it refuses mainnet policy preparation. Input must be a regular file
with one link, not a symlink, at most the specified one MiB, with valid UTF-8. The opened
file must stay unchanged during the read. No RPC, key loading, signing, policy installation or file write
occurs inside the command.

Sign the exact UTF-8 bytes of the JSON request's `text` property with the configured
operator wallet. Do not sign the whole JSON object, a terminal rendering, a reformatted
summary or text with an added newline:

```ts
const bytesToSign = new TextEncoder().encode(request.text);
```

Preserve the returned signature as canonical base64 and verify it with the existing SDK
before using an authorisation:

```ts
import { verifyPolicyAuthorization } from '@solanaut/sdk';

const authorization = { ...request, signature: signatureBase64 };
verifyPolicyAuthorization(policy, authorization);
```

The SDK checks the policy's content, pinned operator, guard, cluster and signature. The
service additionally enforces its externally configured trust and monotonic history.
Human wallet signing and the complete installed-service replacement ceremony need their
own evidence. A prepared request alone cannot authorise a policy.

| Exit / error code | Operator action |
|---|---|
| zero | Review the public request before signing; there is no signature yet. |
| two / `usage` | Supply both flags exactly once, a positive canonical integer and a canonical UTC ISO timestamp. `--help` alone succeeds. |
| one / `source` | Supply a stable regular UTF-8 policy file within the stated limit; check permissions and links. Paths and file contents are redacted from errors. |
| one / `policy` | Correct malformed JSON, invalid policy or unsupported cluster before preparing a signature. |

Evidence and retained failures: [policy command receipt](../evals/sdk/prepare-policy.md).
