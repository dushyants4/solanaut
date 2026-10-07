// guardedWallet: a Solana Agent Kit wallet behind the guard (docs/SPEC.md §8). Solana Agent Kit
// takes any object with BaseWallet's members (read first-hand from solana-agent-kit 2.0.10's types),
// so adopting the guard is one line: `new SolanaAgentKit(guardedWallet(wallet, guard, { rpc }), ...)`.
//
//   - It exposes exactly BaseWallet's members, frozen, and never the wallet it wraps.
//   - Every transaction is checked before the wrapped wallet sees it; a denial throws SolanautDenied.
//   - After signing, the signed message must be the admitted one, signed by the wallet's key.
//     Anything else is stripped of its signatures and thrown: a wallet that appends instructions
//     before it signs (the threat model's A8) never gets its bytes out through the guard.
//   - It sends the bytes it checked itself, through its own RPC, so nothing the wrapped wallet
//     might add on send goes out. Then it waits for the outcome and reports it to the guard. A send
//     the RPC refused is reported failed; one whose fate is unknown, unknown.
//   - signMessage is denied: a raw ed25519 signature over chosen bytes can be a transaction signature.
//   - What it only signed, or sent without learning the outcome, it follows up: before the next
//     proposal it asks the RPC, by signature, and reports what the chain says (D14). Unseen and past
//     its last valid height, an attempt is reported expired; seen, landed or failed.
//
// Transactions are web3.js Transaction or VersionedTransaction objects, read by their shape, so the
// SDK imports no web3.js (ADR-009).
//
// Expiry: a transaction carries its blockhash, not that blockhash's last valid height, so the
// adapter bounds it from above, the current height plus the 150 blocks a blockhash lives. Too high
// a bound only keeps an attempt "in flight" longer, and lets a receipt be redeemed a little late,
// for bytes the chain would refuse anyway.

import type { Guard } from "../guard.ts";
import type { Decision } from "../log.ts";
import { verifyEd25519 } from "../latch.ts";
import { encodeBase58 } from "../base58.ts";
import { SolanautDenied } from "../errors.ts";
import { jsonRpc, type RpcLike } from "./rpc.ts";

export type { RpcLike } from "./rpc.ts";

/** A blockhash is valid for 150 blocks after the one it names. */
export const BLOCKHASH_LIFETIME = 150n;

export interface PublicKeyLike {
  toBase58(): string;
  toBytes(): Uint8Array;
}

/** Solana Agent Kit's BaseWallet, for any transaction type `Tx` (web3.js's Transaction | VersionedTransaction there). */
export interface BaseWalletLike<Tx = any> {
  readonly publicKey: PublicKeyLike;
  signTransaction<T extends Tx>(transaction: T): Promise<T>;
  signAllTransactions<T extends Tx>(transactions: T[]): Promise<T[]>;
  sendTransaction?: <T extends Tx>(transaction: T) => Promise<string>;
  signAndSendTransaction: <T extends Tx>(transaction: T, options?: unknown) => Promise<{ signature: string }>;
  signMessage(message: Uint8Array): Promise<Uint8Array>;
}

export interface GuardedWalletOptions {
  /** The RPC the guard sends through and reads heights from: a URL, or an RpcLike. Required. */
  rpc: RpcLike | string;
  /** The clock for decisions. Defaults to Date.now. */
  now?: () => number;
}

interface Admitted {
  message: Uint8Array;
  decision: Decision;
  lastValidBlockHeight: bigint;
}

/** A signed attempt whose outcome the guard has not been told. */
interface Unreported {
  decision: string;
  signature: string;
  lastValidBlockHeight: bigint;
}

const equal = (a: Uint8Array, b: Uint8Array) => a.length === b.length && a.every((x, i) => x === b[i]);

/** The message bytes a web3.js transaction's signatures cover. */
function messageOf(tx: any): Uint8Array {
  if (tx && typeof tx.serializeMessage === "function") return new Uint8Array(tx.serializeMessage());
  if (tx && tx.message && typeof tx.message.serialize === "function") return new Uint8Array(tx.message.serialize());
  throw new TypeError("not a web3.js Transaction or VersionedTransaction");
}

function signatureOf(tx: any, key: string): Uint8Array | null {
  if (typeof tx.serializeMessage === "function") {
    const s = (tx.signatures ?? []).find((x: any) => x?.publicKey?.toBase58?.() === key);
    return s?.signature ? new Uint8Array(s.signature) : null;
  }
  const keys: any[] = tx.message?.staticAccountKeys ?? [];
  const i = keys.findIndex((k) => k?.toBase58?.() === key);
  return i >= 0 && tx.signatures?.[i] ? new Uint8Array(tx.signatures[i]) : null;
}

/** The transaction's id, its first signature, if the wallet's key made it: the fee payer's. */
function idOf(tx: any, key: string): string | null {
  const first = typeof tx.serializeMessage === "function" ? tx.signatures?.[0] : { publicKey: tx.message?.staticAccountKeys?.[0], signature: tx.signatures?.[0] };
  if (first?.publicKey?.toBase58?.() !== key || !first.signature) return null;
  return encodeBase58(new Uint8Array(first.signature));
}

/** Remove every signature from a transaction object the caller holds. */
function strip(tx: any): void {
  try {
    if (typeof tx.serializeMessage === "function") for (const s of tx.signatures ?? []) s.signature = null;
    else if (Array.isArray(tx.signatures)) tx.signatures = tx.signatures.map(() => new Uint8Array(64));
  } catch {
    // Frozen or foreign: the throw that follows still stops the caller.
  }
}

export function guardedWallet<Tx = any>(wallet: BaseWalletLike<Tx>, guard: Guard, opts: GuardedWalletOptions): BaseWalletLike<Tx> {
  if (!opts?.rpc) throw new Error("guardedWallet needs an RPC: it sends the bytes it checked itself, and reads block heights");
  const rpc = typeof opts.rpc === "string" ? jsonRpc(opts.rpc) : opts.rpc;
  const now = opts.now ?? Date.now;
  const key = wallet.publicKey.toBase58();
  if (!guard.policy.principal.includes(key)) throw new Error(`the wallet's key ${key} is not in the policy's principal`);

  const unreported = new Map<string, Unreported>();

  /** Follow up what was signed and not seen land: report what the chain says, before the next check. */
  async function reconcile(): Promise<void> {
    if (!rpc.getSignatureStatus || unreported.size === 0) return;
    let height: bigint;
    try {
      height = await rpc.getBlockHeight();
    } catch {
      return; // Unread, nothing is reported: the guard holds the intents, which is safe.
    }
    for (const u of [...unreported.values()]) {
      let status: "landed" | "failed" | "pending" | null;
      try {
        status = await rpc.getSignatureStatus(u.signature);
      } catch {
        continue;
      }
      // The height was read before the status: past it, a signature the chain does not show never landed.
      const outcome = status === "landed" || status === "failed" ? status : status === null && height > u.lastValidBlockHeight ? "expired" : null;
      if (!outcome) continue;
      try {
        guard.report(u.decision, outcome);
      } catch {
        // Already reported by the caller: nothing left to follow up.
      }
      unreported.delete(u.decision);
    }
  }

  const follow = (tx: Tx, a: Admitted) => {
    const id = idOf(tx, key);
    if (id) unreported.set(a.decision.hash, { decision: a.decision.hash, signature: id, lastValidBlockHeight: a.lastValidBlockHeight });
  };

  /** Release decisions that will never be signed: their bytes cannot land. */
  const expire = (as: Admitted[]) => {
    for (const a of as) {
      try {
        guard.report(a.decision.hash, "expired");
      } catch {
        // Already final: nothing to release.
      }
    }
  };

  async function admit(tx: Tx): Promise<Admitted> {
    const message = messageOf(tx);
    const blockHeight = await rpc.getBlockHeight();
    const lastValidBlockHeight = blockHeight + BLOCKHASH_LIFETIME;
    const decision = guard.check({ message, at: now(), blockHeight, lastValidBlockHeight });
    if (!decision.allow) throw new SolanautDenied(decision.rule!, decision.reason, decision);
    const receipt = guard.redeem(message, decision.hash, blockHeight);
    if (!receipt.ok) throw new SolanautDenied("fail-closed", receipt.reason, decision);
    return { message, decision, lastValidBlockHeight };
  }

  async function admitAll(txs: Tx[]): Promise<Admitted[]> {
    const done: Admitted[] = [];
    try {
      for (const tx of txs) done.push(await admit(tx));
      return done;
    } catch (e) {
      expire(done);
      throw e;
    }
  }

  /** The admitted message, signed by the wallet's key. */
  const signedAsAdmitted = (tx: Tx | undefined, a: Admitted): boolean => {
    if (tx === undefined) return false;
    try {
      return equal(messageOf(tx), a.message) && verifyEd25519(key, a.message, signatureOf(tx, key) ?? new Uint8Array());
    } catch {
      return false;
    }
  };

  /**
   * After the wallet was asked and the call fails: strip every signature it left, on the caller's objects and on what
   * it returned. An admitted message it validly signed may yet land, so it is held as unknown and followed up; the
   * rest were never signed, and are released.
   */
  function release(txs: Tx[], returned: Tx[], admitted: Admitted[]): void {
    admitted.forEach((a, i) => {
      const seen = [txs[i], returned[i]].find((tx) => signedAsAdmitted(tx, a));
      if (!seen) return expire([a]);
      follow(seen, a);
      try {
        guard.report(a.decision.hash, "unknown");
      } catch {
        // Already final.
      }
    });
    [...txs, ...returned].forEach(strip);
  }

  async function signAll(txs: Tx[]): Promise<{ signed: Tx[]; admitted: Admitted[] }> {
    await reconcile();
    const admitted = await admitAll(txs);
    let signed: Tx[];
    try {
      signed = txs.length === 1 ? [await wallet.signTransaction(txs[0]!)] : await wallet.signAllTransactions(txs);
    } catch (e) {
      release(txs, [], admitted);
      throw e;
    }
    if (signed.length === admitted.length && admitted.every((a, i) => signedAsAdmitted(signed[i], a))) return { signed, admitted };
    release(txs, signed, admitted);
    throw new SolanautDenied("wallet-changed-message", "the wallet signed something other than the admitted messages, not with its key, or not all of them; its signatures were removed", null);
  }

  /** Sign only: the caller sends. Follow each up, since nothing else will report it. */
  async function signOnly(txs: Tx[]): Promise<Tx[]> {
    const { signed, admitted } = await signAll(txs);
    signed.forEach((tx, i) => follow(tx, admitted[i]!));
    return signed;
  }

  async function signAndSend<T extends Tx>(tx: T, options?: unknown): Promise<{ signature: string }> {
    const { signed, admitted } = await signAll([tx]);
    const a = admitted[0]!;
    let signature: string;
    try {
      signature = await rpc.sendRawTransaction(new Uint8Array((signed[0] as any).serialize()), options);
    } catch (e) {
      // Only the RPC's refusal proves the bytes went nowhere. After any other failure they may still
      // land, so the payment stays in flight until its blockhash expires, rather than free a re-sign.
      const refused = (e as { refused?: unknown } | null)?.refused === true;
      guard.report(a.decision.hash, refused ? "failed" : "unknown");
      if (!refused) follow(signed[0]!, a);
      throw e;
    }
    const outcome = await rpc.confirm(signature, a.lastValidBlockHeight).catch(() => "unknown" as const);
    guard.report(a.decision.hash, outcome);
    if (outcome === "unknown") follow(signed[0]!, a);
    return { signature };
  }

  return Object.freeze({
    publicKey: wallet.publicKey,
    signTransaction: async <T extends Tx>(tx: T) => (await signOnly([tx]))[0] as T,
    signAllTransactions: async <T extends Tx>(txs: T[]) => (await signOnly(txs)) as T[],
    signAndSendTransaction: signAndSend,
    sendTransaction: async <T extends Tx>(tx: T) => (await signAndSend(tx)).signature,
    signMessage: async (_message: Uint8Array): Promise<Uint8Array> => {
      throw new SolanautDenied("message-signing-denied", "policy v1 never signs off-chain messages: a raw signature over chosen bytes can be a transaction signature", null);
    },
  });
}
