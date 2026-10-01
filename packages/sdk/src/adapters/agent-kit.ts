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
//     might add on send goes out. Then it waits for the outcome and reports it to the guard.
//   - signMessage is denied: a raw ed25519 signature over chosen bytes can be a transaction signature.
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

  /** The signed message must be the admitted one, signed by the wallet's key. Otherwise strip it and throw. */
  function verify(signed: Tx[], admitted: Admitted[]): void {
    const bad = signed.findIndex((tx, i) => {
      try {
        return !(equal(messageOf(tx), admitted[i]!.message) && verifyEd25519(key, admitted[i]!.message, signatureOf(tx, key) ?? new Uint8Array()));
      } catch {
        return true;
      }
    });
    if (bad < 0 && signed.length === admitted.length) return;
    signed.forEach(strip);
    expire(admitted);
    throw new SolanautDenied("wallet-changed-message", "the wallet signed something other than the admitted message, or not with its key; its signatures were removed", admitted[Math.max(bad, 0)]?.decision ?? null);
  }

  async function signAll(txs: Tx[]): Promise<{ signed: Tx[]; admitted: Admitted[] }> {
    const admitted = await admitAll(txs);
    let signed: Tx[];
    try {
      signed = txs.length === 1 ? [await wallet.signTransaction(txs[0]!)] : await wallet.signAllTransactions(txs);
    } catch (e) {
      expire(admitted);
      throw e;
    }
    verify(signed, admitted);
    return { signed, admitted };
  }

  async function signAndSend<T extends Tx>(tx: T, options?: unknown): Promise<{ signature: string }> {
    const { signed, admitted } = await signAll([tx]);
    const a = admitted[0]!;
    let signature: string;
    try {
      signature = await rpc.sendRawTransaction(new Uint8Array((signed[0] as any).serialize()), options);
    } catch (e) {
      guard.report(a.decision.hash, "failed");
      throw e;
    }
    const outcome = await rpc.confirm(signature, a.lastValidBlockHeight).catch(() => "unknown" as const);
    guard.report(a.decision.hash, outcome);
    return { signature };
  }

  return Object.freeze({
    publicKey: wallet.publicKey,
    signTransaction: async <T extends Tx>(tx: T) => (await signAll([tx])).signed[0] as T,
    signAllTransactions: async <T extends Tx>(txs: T[]) => (await signAll(txs)).signed as T[],
    signAndSendTransaction: signAndSend,
    sendTransaction: async <T extends Tx>(tx: T) => (await signAndSend(tx)).signature,
    signMessage: async (_message: Uint8Array): Promise<Uint8Array> => {
      throw new SolanautDenied("message-signing-denied", "policy v1 never signs off-chain messages: a raw signature over chosen bytes can be a transaction signature", null);
    },
  });
}
