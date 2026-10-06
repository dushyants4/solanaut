import type { Guard } from "@solanaut/sdk";
import type { createSignerCore } from "./core.ts";
import { bindRequest, requestKey } from "../../../packages/sdk/src/request.ts";
import { canonicalJSON } from "../../../packages/sdk/src/canonical.ts";
import type { Proposal } from "./core.ts";
export function createRequestHandler(options: { guard: Guard; core: Pick<ReturnType<typeof createSignerCore>, "propose" | "report">; now(): number; status(): unknown }) {
  const { guard, core, now, status } = options;
  const pending = new Map<string, { payload: string; promise: Promise<unknown> }>();
  return async (input: Record<string, unknown>): Promise<unknown> => {
    const r = Object.freeze({ ...input }); const selected = r.method;
    if (selected !== "propose" && selected !== "report" && selected !== "status") throw new Error("unknown method");
    const method: "propose" | "report" | "status" = selected;
    const identity = { clientId: r.clientId as string, id: r.id as string };
    const key = requestKey(bindRequest(guard.policy.latch.guardId, identity, new Uint8Array()));
    const payload = canonicalJSON({ method, ...(method === "propose" ? { message: r.message, group: r.group ?? null } : method === "report" ? { decision: r.decision } : {}) });
    const active = pending.get(key);
    if (active) { if (active.payload !== payload) throw new Error("request identity reused with different payload"); return active.promise; }
    const validDeadline = () => { const at = now(); return typeof r.deadline === "number" && Number.isFinite(r.deadline) && r.deadline > at && r.deadline <= at + 30_000; };
    async function run(): Promise<unknown> {
      if (method === "propose") {
        if (guard.entries().some((e) => e.kind === "request" && requestKey(e.request) === key)) throw new Error("request identity reused with different payload");
        return core.propose(r as unknown as Proposal);
      }
      const start = guard.beginRequest(identity, method, method === "status" ? {} : { decision: r.decision }, now());
      const old = guard.requestResult(start.hash); if (old !== undefined) return old;
      let result: unknown = { status: "denied", code: "deadline" };
      if (validDeadline()) {
        try {
          if (method === "status") result = await status();
          else {
            await core.report(r.decision as string, r.deadline as number);
            const report = guard.entries().findLast((e) => e.kind === "report" && e.decision === r.decision && e.outcome !== "unknown");
            result = { decision: r.decision, outcome: report?.kind === "report" ? report.outcome : "unresolved" };
          }
          if (!validDeadline()) result = { status: "denied", code: "deadline" };
        } catch { result = { status: "denied", code: "unavailable" }; }
      }
      guard.finishRequest(start.hash, result); return guard.requestResult(start.hash);
    }
    const promise = Promise.resolve().then(run); pending.set(key, { payload, promise });
    try { return await promise; } finally { pending.delete(key); }
  };
}
