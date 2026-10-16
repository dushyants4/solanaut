# SIG-8 native process-kill qualification

The frozen native workload ran 100 generated cases across the 12 declared
decision, redemption, signing, send and report persistence boundaries. Each
case used an actual `SIGKILL`, restarted the executable from its record, and
verified bounded admission/sign/send counts plus deterministic replay.

The pilot first failed because the generated Unix socket path exceeded Linux's
`sun_path` limit. The driver was corrected to use a dedicated short socket
directory; the 12-boundary pilot then passed. The complete run passed all 100
cases on Node 26.7.0/Linux with fake loopback RPC providers and a temporary
`solana-keygen` devnet key. It did not send to devnet and does not establish
power-loss durability, isolated-user operation or exactly-once chain execution.

Receipt: result JSON SHA-256
`22046e0c6ee7141f458fc54929d9d31c4e57622ce8d157ccb8a899d12ff29d38`.
Regenerate: `node evals/signer/native-kills.ts`; contract checks:
`node --test evals/signer/native-kill-contract.test.ts`.
