// guardedSigner: a @solana/kit partial signer behind the guard (docs/SPEC.md §8). It checks every
// transaction's message bytes, all of them before any is signed, then delegates to the signer it
// wraps and verifies each signature it returns over the admitted bytes. A partial signer signs
// without changing the transaction, so the bytes are checked once; the signatures are checked
// again. Wrapping a modifying or sending signer is out of scope in the Beta.
//
// A kit transaction carries its lifetime, so the expiry is exact. Without an RPC for the current
// height, a receipt's expiry is left to the chain, which refuses expired bytes anyway.

import type { Guard } from "../guard.ts";
import type { Decision } from "../log.ts";
import { verifyEd25519 } from "../latch.ts";
import { SolanautDenied } from "../errors.ts";
import type { RpcLike } from "./rpc.ts";

/** A kit Transaction, as far as the guard reads it. */
export interface KitTransactionLike {
  readonly messageBytes: ArrayLike<number>;
  readonly signatures: Readonly<Record<string, unknown>>;
  readonly lifetimeConstraint?: unknown;
}

/** kit's TransactionPartialSigner. */
export interface PartialSignerLike {
  readonly address: string;
  signTransactions(transactions: readonly KitTransactionLike[], config?: unknown): Promise<readonly Readonly<Record<string, Uint8Array>>[]>;
}

export interface GuardedSignerOptions {
  now?: () => number;
  /** Optional: an RPC for the current block height, so receipts are checked against it. */
  rpc?: Pick<RpcLike, "getBlockHeight">;
}

function lastValidBlockHeightOf(lifetime: unknown): bigint | undefined {
  if (lifetime && typeof lifetime === "object" && "lastValidBlockHeight" in lifetime) {
    const h = (lifetime as { lastValidBlockHeight: unknown }).lastValidBlockHeight;
    if (typeof h === "bigint") return h;
  }
  return undefined;
}

export function guardedSigner<S extends PartialSignerLike>(signer: S, guard: Guard, opts: GuardedSignerOptions = {}): PartialSignerLike & { readonly address: S["address"] } {
  const now = opts.now ?? Date.now;
  if (!guard.policy.principal.includes(signer.address)) throw new Error(`the signer's address ${signer.address} is not in the policy's principal`);

  const expire = (ds: Decision[]) => {
    for (const d of ds) {
      try {
        guard.report(d.hash, "expired");
      } catch {
        // Already final.
      }
    }
  };

  async function signTransactions(transactions: readonly KitTransactionLike[], config?: unknown) {
    const admitted: { message: Uint8Array; decision: Decision }[] = [];
    try {
      for (const tx of transactions) {
        const message = new Uint8Array(tx.messageBytes);
        const lastValidBlockHeight = lastValidBlockHeightOf(tx.lifetimeConstraint);
        const blockHeight = opts.rpc ? await opts.rpc.getBlockHeight() : undefined;
        const decision = guard.check({ message, at: now(), blockHeight, lastValidBlockHeight });
        if (!decision.allow) throw new SolanautDenied(decision.rule!, decision.reason, decision);
        const receipt = guard.redeem(message, decision.hash, blockHeight ?? lastValidBlockHeight);
        if (!receipt.ok) throw new SolanautDenied("fail-closed", receipt.reason, decision);
        admitted.push({ message, decision });
      }
    } catch (e) {
      expire(admitted.map((a) => a.decision));
      throw e;
    }
    let signatures: readonly Readonly<Record<string, Uint8Array>>[];
    try {
      signatures = await signer.signTransactions(transactions, config);
    } catch (e) {
      expire(admitted.map((a) => a.decision));
      throw e;
    }
    signatures.forEach((dict, i) => {
      const sig = dict?.[signer.address];
      const a = admitted[i];
      if (!a || !(sig instanceof Uint8Array) || !verifyEd25519(signer.address, a.message, sig)) {
        expire(admitted.map((x) => x.decision));
        throw new SolanautDenied("wallet-changed-message", "the signer returned a signature that does not verify over the admitted message", a?.decision ?? null);
      }
    });
    return signatures;
  }

  return Object.freeze({ address: signer.address, signTransactions });
}
