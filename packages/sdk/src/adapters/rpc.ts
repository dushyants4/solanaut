// The little an adapter needs from an RPC, over plain JSON-RPC: the block height, sending signed
// bytes, and the outcome of a signature. No library in between, so the SDK stays free of web3.js.

import type { Outcome } from "../log.ts";

export interface RpcLike {
  getBlockHeight(): Promise<bigint>;
  /** Send signed wire bytes; resolves to the signature, or rejects if the RPC refuses them. */
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
    if (!res.ok) throw new Error(`${method}: the RPC answered HTTP ${res.status}`);
    const body = (await res.json()) as { error?: { message?: string }; result?: T };
    if (body.error) throw new Error(`${method}: ${body.error.message ?? "the RPC refused"}`);
    return body.result as T;
  }
  const getBlockHeight = async () => BigInt(await call<number>("getBlockHeight", [{ commitment }]));
  return {
    getBlockHeight,
    sendRawTransaction: (wire, options) =>
      call<string>("sendTransaction", [Buffer.from(wire).toString("base64"), { encoding: "base64", preflightCommitment: commitment, ...(options as object | undefined) }]),
    async confirm(signature, lastValidBlockHeight) {
      const deadline = Date.now() + timeoutMs;
      while (Date.now() < deadline) {
        const r = await call<{ value: ({ err: unknown; confirmationStatus?: string } | null)[] }>("getSignatureStatuses", [[signature], { searchTransactionHistory: false }]);
        const s = r.value[0];
        if (s && (s.confirmationStatus === "confirmed" || s.confirmationStatus === "finalized")) return s.err ? "failed" : "landed";
        if ((await getBlockHeight()) > lastValidBlockHeight) return "expired";
        await new Promise((resolve) => setTimeout(resolve, pollMs));
      }
      return "unknown";
    },
  };
}
