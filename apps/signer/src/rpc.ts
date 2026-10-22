// The signer's RPC: validated devnet reads, provider health, a single send, and conservative
// outcome evidence from two providers (docs/RPC.md).

import { decodeBase58, decodeMessage, type Outcome } from "@solanaut/sdk";
import type { CoreOptions } from "./core.ts";
export const DEVNET_GENESIS = "EtWTRABZaYq6iMfeYKouRu166VU2xqa1wcaWoxPkrZBG";
export interface RpcOptions {
  fetch?: typeof fetch;
  timeoutMs?: number;
  backoffMs?: number;
  now?: () => number;
}
const integer = (value: unknown): number => {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0)
    throw new Error("invalid RPC integer/height response shape");
  return value;
};
const base58 = (value: unknown, size: number): string => {
  if (typeof value !== "string" || decodeBase58(value).length !== size)
    throw new Error("invalid RPC base58 response shape");
  return value;
};
export function createTrustedRpc(
  urls: readonly string[],
  options: RpcOptions = {},
): CoreOptions["rpc"] & {
  health(): { degraded: boolean; providers: { healthy: boolean; reason: string; slot: number }[] };
} {
  if (urls.length !== 2 || new Set(urls).size !== 2) throw new Error("configure two distinct RPC providers");
  const providers = urls.map((url) => {
    const u = new URL(url);
    if (
      u.username ||
      u.password ||
      (u.protocol !== "https:" && !(u.protocol === "http:" && ["localhost", "127.0.0.1", "[::1]"].includes(u.hostname)))
    )
      throw new Error("RPC endpoints require HTTPS or loopback HTTP");
    return { url, healthy: false, reason: "not checked", slot: 0 };
  });
  const fetcher = options.fetch ?? fetch;
  const now = options.now ?? Date.now;
  const timeoutMs = options.timeoutMs ?? 3000;
  const backoffMs = options.backoffMs ?? 100;
  if (
    !Number.isFinite(timeoutMs) ||
    timeoutMs <= 0 ||
    timeoutMs > 30_000 ||
    !Number.isFinite(backoffMs) ||
    backoffMs < 0
  )
    throw new Error("invalid RPC timeout/backoff");
  let id = 0;
  let floor = 0;
  async function call(
    p: (typeof providers)[number],
    method: string,
    params: unknown[],
    deadline: number,
    send = false,
  ): Promise<any> {
    for (let attempt = 0; ; attempt++) {
      const remaining = Math.min(timeoutMs, deadline - now());
      if (!(remaining > 0)) throw new Error("RPC deadline expired");
      const requestId = ++id;
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), Math.max(1, Math.ceil(remaining)));
      try {
        const res = await fetcher(p.url, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ jsonrpc: "2.0", id: requestId, method, params }),
          signal: controller.signal,
          redirect: "error",
        });
        if (!res.ok) {
          await res.body?.cancel();
          if (!send && attempt < 2 && [429, 503].includes(res.status)) {
            const delay = backoffMs * 2 ** attempt;
            if (now() + delay >= deadline) throw new Error("RPC deadline prevents backoff");
            await new Promise((resolve) => setTimeout(resolve, delay));
            continue;
          }
          throw new Error(`RPC HTTP ${res.status}`);
        }
        const reader = res.body?.getReader();
        if (!reader) throw new Error("missing RPC response body");
        const chunks: Uint8Array[] = [];
        let length = 0;
        try {
          for (;;) {
            const chunk = await reader.read();
            if (chunk.done) break;
            length += chunk.value.length;
            if (length > 262_144) {
              await reader.cancel();
              throw new Error("RPC response too large");
            }
            chunks.push(chunk.value);
          }
        } finally {
          reader.releaseLock();
        }
        const body = JSON.parse(Buffer.concat(chunks).toString("utf8"));
        if (now() >= deadline) throw new Error("RPC response arrived after deadline");
        if (!body || body.jsonrpc !== "2.0" || body.id !== requestId || !("result" in body) || "error" in body)
          throw new Error("invalid or refused RPC response envelope");
        return body.result;
      } finally {
        clearTimeout(timer);
      }
    }
  }
  const config = () => ({ commitment: "confirmed", minContextSlot: floor });
  function context(p: (typeof providers)[number], result: any): any {
    const slot = integer(result?.context?.slot);
    if (slot < floor || slot < p.slot || !("value" in result)) throw new Error("stale RPC context or missing value");
    p.slot = slot;
    floor = Math.max(floor, slot);
    return result.value;
  }
  async function provider<T>(p: (typeof providers)[number], deadline: number, action: () => Promise<T>): Promise<T> {
    try {
      if ((await call(p, "getGenesisHash", [], deadline)) !== DEVNET_GENESIS)
        throw new Error("RPC network identity is not devnet");
      const slot = integer(await call(p, "getSlot", [config()], deadline));
      if (slot < floor || slot < p.slot) throw new Error("stale RPC context");
      p.slot = slot;
      floor = Math.max(floor, slot);
      const value = await action();
      p.healthy = true;
      p.reason = "";
      return value;
    } catch {
      p.healthy = false;
      p.reason = "provider unavailable";
      throw new Error("RPC provider unavailable");
    }
  }
  async function available<T>(deadline: number, action: (p: (typeof providers)[number]) => Promise<T>): Promise<T[]> {
    const results = await Promise.allSettled(providers.map((p) => provider(p, deadline, () => action(p))));
    const values = results.flatMap((r) => (r.status === "fulfilled" ? [r.value] : []));
    if (!values.length) throw new Error(`no healthy RPC provider: ${providers.map((p) => p.reason).join("; ")}`);
    return values;
  }
  return {
    health: () => ({
      degraded: providers.every((p) => !p.healthy),
      providers: providers.map(({ healthy, reason, slot }) => ({ healthy, reason, slot })),
    }),
    async observe(message, deadline) {
      const hash = decodeMessage(message).lifetimeToken;
      const values = await available(deadline, async (p) => {
        const latest = context(p, await call(p, "getLatestBlockhash", [config()], deadline));
        const blockhash = base58(latest?.blockhash, 32);
        const lastValid = integer(latest?.lastValidBlockHeight);
        if (blockhash !== hash) throw new Error("proposal blockhash is not the provider's current bounded blockhash");
        if (context(p, await call(p, "isBlockhashValid", [hash, config()], deadline)) !== true)
          throw new Error("proposal blockhash is not valid");
        const height = integer(await call(p, "getBlockHeight", [config()], deadline));
        if (height > lastValid) throw new Error("proposal blockhash lifetime expired");
        return { height: BigInt(height), lastValidBlockHeight: BigInt(lastValid) };
      });
      if (values.some((v) => v.lastValidBlockHeight !== values[0]!.lastValidBlockHeight))
        throw new Error("conflicting RPC lifetime observations");
      return {
        height: values.reduce((h, v) => (v.height > h ? v.height : h), 0n),
        lastValidBlockHeight: values[0]!.lastValidBlockHeight,
      };
    },
    async height(deadline) {
      const values = await available(deadline, async (p) =>
        BigInt(integer(await call(p, "getBlockHeight", [config()], deadline))),
      );
      return values.reduce((h, v) => (v > h ? v : h), 0n);
    },
    async send(wire, deadline) {
      const ready = await available(deadline, async (p) => p);
      const p = ready[0]!;
      try {
        return base58(
          await call(
            p,
            "sendTransaction",
            [
              Buffer.from(wire).toString("base64"),
              {
                encoding: "base64",
                preflightCommitment: "confirmed",
                skipPreflight: false,
                maxRetries: 0,
                minContextSlot: floor,
              },
            ],
            deadline,
            true,
          ),
          64,
        );
      } catch {
        p.healthy = false;
        p.reason = "send unavailable";
        throw new Error("RPC send unavailable");
      }
    },
    async outcome(signature, deadline): Promise<Outcome | null> {
      base58(signature, 64);
      let values: ({ outcome: "landed" | "failed"; slot: number; error: string } | null)[];
      try {
        values = await available(deadline, async (p) => {
          const statuses = context(
            p,
            await call(p, "getSignatureStatuses", [[signature], { searchTransactionHistory: true }], deadline),
          );
          if (!Array.isArray(statuses) || statuses.length !== 1)
            throw new Error("invalid signature status response shape");
          const s = statuses[0];
          if (s === null) return null;
          const slot = integer(s?.slot);
          if (
            slot > p.slot ||
            !["processed", "confirmed", "finalized"].includes(s?.confirmationStatus) ||
            !("err" in s) ||
            (s.err !== null && typeof s.err !== "object")
          )
            throw new Error("invalid signature status response shape");
          if (s.confirmationStatus === "processed") return null;
          return {
            outcome: s.err === null ? ("landed" as const) : ("failed" as const),
            slot,
            error: JSON.stringify(s.err),
          };
        });
      } catch {
        return null;
      }
      if (values.length !== 2 || !values[0] || !values[1] || JSON.stringify(values[0]) !== JSON.stringify(values[1]))
        return null;
      return values[0].outcome;
    },
  };
}
