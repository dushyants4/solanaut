// A synthetic SDK walkthrough: no private keys, signatures, RPC calls or sends.
import { createGuard, replay, encodeBase58 } from "@solanaut/sdk";

const publicBytes = (value) => new Uint8Array(32).fill(value);
const address = (value) => encodeBase58(publicBytes(value));

const policy = {
  version: 1,
  principal: [address(1)],
  programs: { allow: [address(0)], opaque: "deny" },
  destinations: { allow: [address(2)] },
  sol: { maxPerTx: 1_000_000_000n, maxPerWindow: 3_000_000_000n },
  tokens: [],
  fees: { maxPriorityPerTx: 100_000n, maxPerWindow: 50_000_000n, tipAccounts: [] },
  lookupTables: [],
  windowMs: 20_000,
  intents: { maxAttempts: 3 },
  latch: { afterDenials: 3, releaseKey: address(9), guardId: "preview", cluster: "devnet" },
  messages: { allow: false },
  cosign: { allow: false },
  sensor: { expectedPerMinute: 6 },
};

function transfer(destination) {
  const data = new Uint8Array(12);
  const view = new DataView(data.buffer);
  view.setUint32(0, 2, true); // System Program Transfer discriminator.
  view.setBigUint64(4, 1n, true);
  // Legacy message: header, account list, synthetic blockhash and one instruction.
  return Uint8Array.from([
    1, 0, 1, 3,
    ...publicBytes(1), ...publicBytes(destination), ...publicBytes(0),
    ...publicBytes(8),
    1, 2, 2, 0, 1, data.length, ...data,
  ]);
}

function requireResult(condition, message) {
  if (!condition) throw new Error(`${message} Check the reviewed SDK artefact and unchanged example policy; do not bypass the guard.`);
}

const guard = await createGuard({ policy });
let result;
try {
  const message = transfer(2);
  const payment = guard.check({ message, at: 1000, blockHeight: 10n, lastValidBlockHeight: 100n });
  requireResult(payment.allow, `The permitted payment was refused by ${payment.rule}.`);

  const firstRedemption = guard.redeem(message, payment.hash, 10n);
  requireResult(firstRedemption.ok, "The admitted payment's first receipt redemption was refused.");
  const secondRedemption = guard.redeem(message, payment.hash, 10n);
  requireResult(!secondRedemption.ok, "The same receipt was redeemed twice.");

  // Synthetic caller bookkeeping exercises an unresolved outcome, not chain evidence.
  guard.report(payment.hash, "unknown");
  const denied = guard.check({ message: transfer(3), at: 2000, blockHeight: 10n, lastValidBlockHeight: 100n });
  requireResult(!denied.allow && denied.rule === "destination-not-allowed", "The unlisted destination did not receive its expected denial.");

  const reproduced = await replay(guard.entries(), policy);
  requireResult(reproduced.ok, "The in-memory example history did not reproduce through replay.");
  result = {
    payment: "allowed",
    unlistedDestination: denied.rule,
    reusedReceipt: secondRedemption.ok,
    replay: "matched",
    sent: false,
  };
} finally {
  guard.close();
}
console.log(JSON.stringify(result));
