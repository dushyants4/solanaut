# Signer development and trust boundary

> **Draft 1** · 2026-10-05 · owner: integrator · for: operators and signer developers.
> Register: `kb/DOCUMENTS.md`. The operational service is still being implemented.

The executor and devnet RPC boundary live under `apps/signer/src/`. Their current evidence uses
fake RPCs and reconstructed restart states (`evals/signer/core.md`, `evals/signer/rpc.md`). The
checked journal records signed bytes, send-started intent and immutable responses in the admission
chain. Send-started is an ambiguity boundary: recovery never sends those bytes again.

Host attribution is supplied through `authority` at guard creation. Recorded signer decisions
carry the deployment mode and an anchor with wall time and monotonic nanoseconds; reports identify
the signer as their source. The clock advances from that anchor rather than rereading wall time.
The service must use the same clock for admission time and RPC/transport deadlines. Evidence:
`evals/signer/authority.md`, claim S21.

`same-user` mode leaves the key reachable by other code running as that user. The supported
isolated deployment requires the dedicated signer account and protected directory/key permissions
specified by ADR-013. An attribution flag alone cannot establish those permissions. The human's
OS-user creation and isolation drill remain required.

The service will require persistent kernel ownership, established history and externally pinned
signed policy authorization. Its socket methods remain only `propose`, `report` and `status`.
SDK journal methods are trusted host APIs and are not exposed as socket methods. Installation,
socket framing, protected configuration and installed-package qualification remain in progress.
