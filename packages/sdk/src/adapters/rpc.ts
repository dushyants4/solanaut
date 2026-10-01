// The little an adapter needs from an RPC, over plain JSON-RPC: the block height, sending signed
// bytes, and the outcome of a signature. No library in between, so the SDK stays free of web3.js.

import type { Outcome } from "../log.ts";

/**
 * The RPC answered, and refused the request: for a send, the bytes were not forwarded. Only this
 * proves a send went nowhere. A dropped connection, a timeout or an HTTP error says nothing about
 * whether the bytes reached a leader, so it is a plain Error.
 */
export class RpcRefused extends Error {
  readonly refused = true;
  readonly method: string;
  constructor(method: string, message: string) {
    super(`${method}: ${message}`);
    this.name = "RpcRefused";
    this.method = method;
  }
}

export interface RpcLike {
  getBlockHeight(): Promise<bigint>;
  /**
   * Send signed wire bytes; resolves to the signature. Rejects with an error whose `refused` is true
   * (`RpcRefused`) only when the RPC refused the bytes; any other rejection means their fate is unknown.
   */
  sendRawTransaction(wire: Uint8Array, options?: unknown): Promise<string>;
  /** Wait for a sent signature's outcome, until its blockhash's last valid height has passed. */
  confirm(signature: string, lastValidBlockHeight: bigint): Promise<Outcome>;
}

export interface JsonRpcOptions {
  commitment?: "confirmed" | "finalized";
  pollMs?: number;
  /** Give up waiting, and report the outcome unknown, after this long. */
  timeoutMs?: number;
}

/** An RpcLike over HTTP JSON-RPC at `url`. */
export function jsonRpc(url: string, o: JsonRpcOptions = {}): RpcLike {
  const commitment = o.commitment ?? "confirmed";
  const pollMs = o.pollMs ?? 500;
  const timeoutMs = o.timeoutMs ?? 90_000;
  let id = 0;
  async function call<T>(method: string, params: unknown[]): Promise<T> {
    const res = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: ++id, method, params }),
    });
    // An HTTP failure (a rate limit, a gateway error) is not a refusal: what happened to the request is unknown.
    if (!res.ok) throw new Error(`${method}: the RPC answered HTTP ${res.status}`);
    const body = (await res.json()) as { error?: { message?: string }; result?: T };
    if (body.error) throw new RpcRefused(method, body.error.message ?? "the RPC refused");
    return body.result as T;
  }
  /** A read, tried again with backoff unless the RPC refused it: a read changes nothing. A send is never retried here. */
  async function read<T>(method: string, params: unknown[]): Promise<T> {
    for (let attempt = 0; ; attempt++) {
      try {
        return await call<T>(method, params);
      } catch (e) {
        if (e instanceof RpcRefused || attempt >= 4) throw e;
        await new Promise((resolve) => setTimeout(resolve, Math.min(pollMs * 2 ** attempt, 8_000)));
      }
    }
  }
  const getBlockHeight = async () => BigInt(await read<number>("getBlockHeight", [{ commitment }]));
  return {
    getBlockHeight,
    sendRawTransaction: (wire, options) =>
      call<string>("sendTransaction", [Buffer.from(wire).toString("base64"), { encoding: "base64", preflightCommitment: commitment, ...(options as object | undefined) }]),
    async confirm(signature, lastValidBlockHeight) {
      const deadline = Date.now() + timeoutMs;
      let errors = 0;
      while (Date.now() < deadline) {
        try {
          const r = await call<{ value: ({ err: unknown; confirmationStatus?: string } | null)[] }>("getSignatureStatuses", [[signature], { searchTransactionHistory: false }]);
          const s = r.value[0];
          if (s && (s.confirmationStatus === "confirmed" || s.confirmationStatus === "finalized")) return s.err ? "failed" : "landed";
          if ((await getBlockHeight()) > lastValidBlockHeight) return "expired";
          errors = 0;
        } catch {
          // A failed read (a public RPC's rate limit, a dropped connection) says nothing about the
          // transaction: back off and read again, until the deadline makes the outcome unknown.
          errors++;
        }
        await new Promise((resolve) => setTimeout(resolve, Math.min(pollMs * 2 ** errors, 8_000)));
      }
      return "unknown";
    },
  };
}
