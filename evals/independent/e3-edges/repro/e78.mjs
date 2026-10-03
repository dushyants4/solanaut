// E78: a wallet signs a batch in place but returns only the first transaction.
import crypto from "node:crypto";
import { VersionedTransaction, VersionedMessage, PublicKey } from "@solana/web3.js";
import { createGuard, guardedWallet, encodeBase58 } from "@solanaut/sdk";
import { makeKey, makePolicy, randomAddress, transferMessage } from "../tests/helpers.mjs";

const agent = makeKey(), operator = makeKey(), dests = [randomAddress(), randomAddress()];
const guard = await createGuard({ policy: makePolicy({ principal: agent.address, destinations: dests, releaseKey: operator.address }) });
const pk = new PublicKey(agent.publicKeyBytes);
const wallet = {
  publicKey: pk,
  async signTransaction(tx) { tx.addSignature(pk, agent.sign(tx.message.serialize())); return tx; },
  async signAllTransactions(txs) { for (const t of txs) await this.signTransaction(t); return txs.slice(0, 1); }, // drops one
  async signAndSendTransaction() { throw new Error("unused"); },
  async signMessage() { throw new Error("unused"); },
};
const rpc = { getBlockHeight: async () => 1000n, sendRawTransaction: async () => "x", confirm: async () => "landed", getSignatureStatus: async () => null };
const gw = guardedWallet(wallet, guard, { rpc, now: () => Date.now() });
const tx = (i, l) => new VersionedTransaction(VersionedMessage.deserialize(transferMessage({ from: agent.address, to: dests[i], lamports: l })));
const txs = [tx(0, 1000n), tx(1, 2000n)];
try { await gw.signAllTransactions(txs); } catch (e) { console.log("threw:", e.rule); }
const sig = txs[1].signatures[0];
const msg = txs[1].message.serialize();
const valid = crypto.verify(null, Buffer.from(msg), crypto.createPublicKey({ key: Buffer.concat([Buffer.from("302a300506032b6570032100", "hex"), Buffer.from(agent.publicKeyBytes)]), format: "der", type: "spki" }), Buffer.from(sig));
console.log("tx[1] still signed:", sig.some((b) => b !== 0), "valid over its admitted message:", valid, encodeBase58(sig).slice(0, 12) + "…");
console.log("record:", guard.entries().map((e) => e.kind === "report" ? `report ${e.outcome}` : e.kind).join(", "));
// the same payment is now admitted again, while tx[1]'s signed bytes can still land
const again = guard.check({ message: transferMessage({ from: agent.address, to: dests[1], lamports: 2000n }), at: Date.now() + 1 });
console.log("re-proposal of payment 1:", again.allow ? "allowed" : again.rule);
