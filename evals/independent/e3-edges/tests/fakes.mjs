// Fakes for the adapters: a BaseWalletLike over web3.js transactions, and an RpcLike. From SPEC.md §8 and API.md.
import { VersionedTransaction, VersionedMessage, Transaction, Message, PublicKey } from "@solana/web3.js";
import { encodeBase58, decodeTransaction } from "@solanaut/sdk";
import { sleep } from "./helpers.mjs";

export function versionedTx(messageBytes) {
  return new VersionedTransaction(VersionedMessage.deserialize(messageBytes));
}
export function legacyTx(messageBytes) {
  return Transaction.populate(Message.from(Buffer.from(messageBytes)));
}
export function messageOf(tx) {
  return tx instanceof VersionedTransaction ? new Uint8Array(tx.message.serialize()) : new Uint8Array(tx.serializeMessage());
}
/** Every signature slot on a web3.js transaction, as bytes or null. */
export function sigsOf(tx) {
  if (tx instanceof VersionedTransaction) return tx.signatures.map((s) => (s && s.some((b) => b !== 0) ? s : null));
  return tx.signatures.map((s) => (s.signature ? new Uint8Array(s.signature) : null));
}
export function hasAnySignature(tx) { return sigsOf(tx).some((s) => s !== null); }

/**
 * A wallet over the key `key`. mode:
 *   honest   signs what it is given
 *   change   swaps the message for `evil(messageBytes)` and signs that
 *   badsig   signs with `otherKey` (the message is unchanged, the signature does not verify)
 *   refuse   throws
 * changeIndex: in signAllTransactions, changes only that transaction.
 */
export function fakeWallet(key, { mode = "honest", evil, otherKey, changeIndex = -1 } = {}) {
  const pk = new PublicKey(key.publicKeyBytes);
  const calls = { signTransaction: 0, signAllTransactions: 0, signAndSendTransaction: 0, sendTransaction: 0, signMessage: 0 };
  function signOne(tx, change) {
    if (tx instanceof VersionedTransaction) {
      if (change) {
        const evilBytes = evil(new Uint8Array(tx.message.serialize()));
        tx.message = VersionedMessage.deserialize(evilBytes);
        tx.signatures = [key.sign(evilBytes)];
        return tx;
      }
      const msg = new Uint8Array(tx.message.serialize());
      const sig = mode === "badsig" ? otherKey.sign(msg) : key.sign(msg);
      tx.addSignature(pk, sig);
      return tx;
    }
    if (change) {
      // legacy: change the transfer's lamports in place, then sign the new message
      const ix = tx.instructions[tx.instructions.length - 1];
      const data = Buffer.from(ix.data);
      data.writeBigUInt64LE(data.readBigUInt64LE(4) * 1000n, 4);
      ix.data = data;
      const msg = tx.serializeMessage();
      tx.addSignature(pk, Buffer.from(key.sign(msg)));
      return tx;
    }
    const msg = tx.serializeMessage();
    const sig = mode === "badsig" ? otherKey.sign(msg) : key.sign(msg);
    tx.addSignature(pk, Buffer.from(sig));
    return tx;
  }
  const wallet = {
    publicKey: pk,
    async signTransaction(tx) {
      calls.signTransaction++;
      if (mode === "refuse") throw new Error("user rejected the request");
      return signOne(tx, mode === "change");
    },
    async signAllTransactions(txs) {
      calls.signAllTransactions++;
      if (mode === "refuse") throw new Error("user rejected the request");
      return txs.map((t, i) => signOne(t, mode === "change" || i === changeIndex));
    },
    async signAndSendTransaction() { calls.signAndSendTransaction++; throw new Error("the wrapped wallet's send was called"); },
    async sendTransaction() { calls.sendTransaction++; throw new Error("the wrapped wallet's send was called"); },
    async signMessage() { calls.signMessage++; return new Uint8Array(64); },
  };
  return { wallet, calls, pk };
}

/** The first signature of a legacy/v0 wire transaction, base58. */
export function firstSignature(wireBytes) {
  const { signatures } = decodeTransaction(wireBytes);
  return encodeBase58(signatures[0]);
}

/**
 * A fake RPC. `height` is mutable through `rpc.state.height` (a bigint or a function).
 *   send: "ok" | "refused" | "error" | an Error | a function run before answering
 *   confirm: an Outcome, a function, or "throw"
 *   status: for getSignatureStatus (a value or a function); withStatus: false leaves the member out
 */
export function fakeRpc({ height = 1000n, send = "ok", sendDelayMs = 0, confirm = "landed", status = null, withStatus = true, refusedClass } = {}) {
  const state = { height, sent: [], log: [], statusAsked: [] };
  const rpc = {
    state,
    async getBlockHeight() { state.log.push("getBlockHeight"); return typeof state.height === "function" ? state.height() : state.height; },
    async sendRawTransaction(w) {
      state.log.push("sendRawTransaction");
      state.sent.push(new Uint8Array(w));
      if (sendDelayMs) await sleep(sendDelayMs);
      if (send === "refused") throw new refusedClass("sendTransaction", "Transaction simulation failed: insufficient funds");
      if (send === "error") { const e = new Error("socket hang up"); e.code = "ECONNRESET"; throw e; }
      if (send instanceof Error) throw send;
      if (typeof send === "function") await send(w, state);
      return firstSignature(w);
    },
    async confirm(sig, lvbh) {
      state.log.push(`confirm:${lvbh}`);
      if (confirm === "throw") throw new Error("confirm: fetch failed");
      return typeof confirm === "function" ? confirm(sig, lvbh) : confirm;
    },
  };
  if (withStatus) {
    rpc.getSignatureStatus = async (sig) => {
      state.log.push("getSignatureStatus");
      state.statusAsked.push(sig);
      return typeof status === "function" ? status(sig) : status;
    };
  }
  return rpc;
}
