# Solanaut product page — review draft

Current status, 2026-10-13: wallet batch membership and RPC diagnostic privacy
fixes are integrated (S157). SDK adapter denials now return a class/reference
by default, with reasons delivered to the operator (S158). The repository is
public; package publication, page approval and stable deployment are still owed.
The earlier pending H11/D41/D42 notes below describe their historical evidence.

Editorial update, 2026-10-11: the page remains unapproved. Wallet batch correction
D41 and RPC diagnostic correction D42 are prepared separately and unintegrated
while H11 fails. The maintained package declaration check also owes O10; the
actual SDK type remains intact. See [the release status](release/STAGED-RELEASE.md)
and [RPC diagnostic evidence](../evals/signer/rpc-redaction.md), S156. Component
passes supply no stable deployment, supported installation or publication approval.

Editorial review, 2026-10-09: retain the SDK-preview copy and claim scopes below.
Current recovery component receipts are linked from [STAGED-RELEASE](release/STAGED-RELEASE.md).
They do not supply stable, audited, isolated-service or publication clearance.
Historical preview artefacts remain distinct from later local candidates.

2026-10-08 · integrator/archivist preparation. This is reviewable page copy for a
devnet SDK preview, not an approved publication or stable-release announcement.
No public download or supported isolated-service installation is offered.

Claim IDs beside the copy are editorial traceability. Before publication, retain
accessible evidence links and have the human approve the final page and its
posting. Do not add feature, performance or security promises when translating
this draft into a page. The release decision and remaining work are in
[STAGED-RELEASE](release/STAGED-RELEASE.md).

## Hero

**Decide what your Solana agent may sign.** [S1, S2]

Solanaut checks transaction bytes against an operator-owned policy before a
guarded wallet signs. Transfers to unlisted destinations and calls to unlisted
programs are denied through that guarded path. [S1, S2, S9]

**Proposed devnet SDK preview · test funds only.** [S5, S14]

Primary action: **Read the SDK guide** → [SDK reference](SDK.md).
Private review action: **Run the offline preview** → [preview walkthrough](PREVIEW.md).
Secondary action: **Inspect the evidence** → [evaluation receipts](../evals/README.md).
These are documentation links. The preview walkthrough uses a private local
artefact; do not expose its builder-specific paths as public downloads. Public link
targets must be reviewed before the page is posted.

## Policy before signing

Keep permitted programs and destinations in a policy outside the agent's reach.
The policy is copied and frozen when the guard is created; keeping the original
configuration outside agent control is a condition of this boundary. [S1, S2]

The guard reads legacy, v0 and v1 transaction messages from their bytes. Its
recorded decoder tests compare those supported formats with kit. [S9]

## Retry-loop evidence

An identical failing transfer is stopped by the control loop in the recorded
sandbox. The receipt includes the scenario and command that reproduce it. [S3]

Read the [sandbox and controller evidence](../evals/sdk/keel.md).
This scenario does not establish a production detection rate or behaviour for
every changing transaction stream. [S3]

## Recovery evidence

The local process-kill battery restores a record matching the uninterrupted run
and replays it without divergence. This evidence concerns process crashes on
the tested machine and filesystem; power-loss durability was not measured. [S6]

Signed SDK policy tests also preserve pending reservations, used receipts and
the latch across restart and policy history. These are SDK tests, not installed
isolated-signer qualification. [S15]

Read the [crash receipt](../evals/sdk/durable.md) and
[signed policy receipt](../evals/sdk/signed-policy.md).

## Integration scope

A scripted Solana Agent Kit integration has been exercised on a local validator
and devnet. Its plugin payment actions remain subject to the framework's second
signature being refused; those plugins do not work unchanged. [S10]

A private compiled SDK candidate has been installed from a tarball outside the
repository. Its JavaScript, declarations and command entry points pass the
defined installed-package battery without TypeScript loader flags. [S14]

Read the [Agent Kit devnet receipt](../evals/agentkit/sak-devnet.md) and
[installed SDK receipt](../evals/packaging/packed-sdk.md).

## What is available for evaluation

The current package is a private SDK candidate. Registry publication and stable
deployment qualification remain outstanding. [S14]

SDK checks run within a trusted caller's process and remain advisory. The
isolated signer, Phantom workflow and operational upgrade qualification remain
unfinished. [S15, S30]

The same-user signer composition has local component tests, with host-provided
signing and RPC. Protected key loading, an installed executable and dedicated
user deployment are still work to complete. [S30]

Use devnet test funds for evaluation. [S5]

## Private claim and evidence map

| Copy block | Permitted rows | Scope that must remain |
|---|---|---|
| Hero and policy | [S1, S2](CLAIMS.md) | Guarded signing path; configuration outside agent control; no universal protection for a key used elsewhere. |
| Preview status | [S5, S14](CLAIMS.md) | Devnet/test funds; private compiled candidate; no existing registry availability or stable deployment claim. |
| Supported message formats | [S9](CLAIMS.md) | Recorded decoder tests; no inference that every token/program path is qualified on-chain. |
| Retry loop | [S3](CLAIMS.md) | Identical failing transfer in the sandbox; no detection, fee-saving or latency claim. |
| Process-crash recovery | [S6](CLAIMS.md) | Local process-crash battery and its machine/filesystem scope; no power-loss claim. |
| Signed policy recovery | [S15](CLAIMS.md) | Builder-authored SDK tests; reservations/receipts/latch preserved; isolated, Phantom and upgrade evidence still owed. |
| Agent Kit integration | [S10](CLAIMS.md) | Scripted local/devnet integration; second-signature limitation accompanies the claim. |
| Installed SDK | [S14](CLAIMS.md) | Actual external tarball consumer battery; no clean-machine deployment, provenance or publication inference. |
| Private preview walkthrough | [S82](CLAIMS.md) | Actual synthetic installed SDK example; no public artefact availability or human-usability claim. |
| Signer status | [S30](CLAIMS.md) | Same-user component with host-provided signing/RPC; installed executable and isolated deployment unfinished. |

There are no new measured claims in this draft. The formal milestone percentage
in [the private progress receipt](../evals/release/progress.md) is excluded from
page copy: it measures milestone accounting, not product readiness or security.

Publication review must also preserve current defect/CI status. D22/D23 have
candidate corrections; their release qualification and the exact-candidate freeze
are pending. See the staged release draft. Do not
turn scoped historical passing receipts into a claim that current CI is green.
No stable, audited, certified, isolated-service or mainnet claim is authorised
by this page. All existing [READINESS](READINESS.md) gates remain required.
