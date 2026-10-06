# Signed-policy recovery and settled signing — POL-4, LIF-7

Measured 2026-10-06 on Node 26.7.0, Keel 1.0.1 and sensor v1. Revision: the commit
containing this receipt (`git log -- evals/signer/policy-recovery.md`). Builder-authored,
ephemeral in-memory keys and fake RPC; no key file or chain send. Not independent evidence.

`node --test apps/signer/test/policy-recovery.test.ts packages/sdk/test/signing-history.test.ts`
initially passes twelve cases and fails four (`policy-recovery/red.txt`). Signed-policy
upgrade recovery already preserves reservations and refuses old-policy sends at admission,
signed and send-started boundaries. These initially passing cases are checked by mutation.
The failures expose signing/send-intent journal operations after final outcome evidence,
and an executor that sends such signed unsent bytes.

The journal now retains a settled marker from final reports and rejects new signed/send-started
events both live and during replay. Responses remain allowed so an interrupted answer can
complete conservatively. The executor returns an uncertain response without sending; the
separate report remains the authoritative final outcome. Unknown reports do not settle.
The correction rejects resealed invalid histories; no valid local history is expected to
contain these stages, and no stable record compatibility is claimed yet.

Final focused command: seventeen cases pass (`policy-recovery/green.txt`).
`node evals/signer/policy-recovery-faults.ts` catches five faults: omitted executor final
check, forgotten settled history, treating unknown as final, allowing settled signing and
allowing old-policy sends. `node evals/sdk/signing-faults.ts` catches the seven existing
faults. Both restore source and check it passes. Outputs retained beside this receipt;
no missed fault in these runs. Existing runner count updated for the expanded battery.

`npm test`: 307 cases pass; `npm run typecheck`: exit zero;
`npm run test:package`: four installed checks pass. Partial signer/helper count 462 lines:
`wc -l apps/signer/src/*.ts packages/sdk/src/signing.ts packages/sdk/src/authority.ts packages/sdk/src/control-request.ts`.
Operational startup, real kills, dedicated users, live providers, snapshots and the final
budget remain owed. Full qualification and every existing release threshold are unchanged.
