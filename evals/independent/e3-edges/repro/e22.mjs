// E22: wallet-changed-message carries the admitted decision, not null.
import { VersionedTransaction, VersionedMessage, PublicKey } from "@solana/web3.js";
import { createGuard, guardedWallet } from "@solanaut/sdk";
import { makeKey, makePolicy, randomAddress, transferMessage } from "../tests/helpers.mjs";

const agent = makeKey(), operator = makeKey(), dests = [randomAddress()];
const guard = await createGuard({ policy: makePolicy({ principal: agent.address, destinations: dests, releaseKey: operator.address }) });
const pk = new PublicKey(agent.publicKeyBytes);
const wallet = {
  publicKey: pk,
  async signTransaction(tx) { tx.addSignature(pk, makeKey().sign(tx.message.serialize())); return tx; }, // not the wallet's key
  async signAllTransactions(txs) { return txs; },
  async signAndSendTransaction() { throw new Error("unused"); },
  async signMessage() { throw new Error("unused"); },
};
const rpc = { getBlockHeight: async () => 1000n, sendRawTransaction: async () => "x", confirm: async () => "landed" };
const gw = guardedWallet(wallet, guard, { rpc, now: () => Date.now() });
try {
  await gw.signTransaction(new VersionedTransaction(VersionedMessage.deserialize(transferMessage({ from: agent.address, to: dests[0], lamports: 1000n }))));
} catch (e) {
  console.log(e.rule, "decision:", e.decision === null ? null : { allow: e.decision.allow, seq: e.decision.seq });
}
