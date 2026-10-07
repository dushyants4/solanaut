// ADR-019: durable non-admission requests share the proposal identity namespace.
import { canonicalJSON, sha256hex } from "./canonical.ts";
import { bindRequest, requestKey, type RequestIdentity } from "./request.ts";
import type { ControlRequestEntry, ControlResponseEntry, DecisionEntry } from "./log.ts";
export type ControlMethod = "status" | "report" | "propose";
export function controlPayload(method: ControlMethod, input: unknown): string {
  const payload = canonicalJSON(input); const p = JSON.parse(payload);
  if (!p || Array.isArray(p) || typeof p !== "object") throw new Error("invalid control request payload");
  const valid = method === "status" ? payload === "{}" : method === "report" ?
    Object.keys(p).length === 1 && typeof p.decision === "string" && /^[0-9a-f]{64}$/.test(p.decision) : method === "propose" &&
    Object.keys(p).length === 2 && typeof p.message === "string" && p.message.length <= 8192 &&
    (p.group === null || (typeof p.group === "string" && p.group.length <= 256));
  if (!valid) throw new Error("invalid control request payload");
  return payload;
}
export function controlBinding(guardId: string, identity: RequestIdentity, method: ControlMethod, payload: string) {
  const base = bindRequest(guardId, identity, new Uint8Array());
  return Object.freeze({ ...base, digest: sha256hex(canonicalJSON({ method, payload })) });
}
export function controlResult(input: unknown): string {
  const result = canonicalJSON(input);
  if (Buffer.byteLength(result) > 12_288) throw new Error("control response exceeds bounded size");
  return result;
}
export function verifyControlStart(e: ControlRequestEntry, guardId: string, requests: Map<string, DecisionEntry | ControlRequestEntry>) {
  if (!Number.isFinite(e.at) || e.at < 0 || controlPayload(e.method, JSON.parse(e.payload)) !== e.payload) throw new Error("invalid recorded request payload/time");
  const expected = controlBinding(guardId, e.request, e.method, e.payload);
  if (canonicalJSON(e.request) !== canonicalJSON(expected) || requests.has(requestKey(expected))) throw new Error("invalid or duplicate recorded request identity");
}
export function verifyControlResponse(e: ControlResponseEntry, requests: Map<string, DecisionEntry | ControlRequestEntry>, responses: Map<string, ControlResponseEntry>) {
  if (![...requests.values()].some((r) => r.kind === "request" && r.hash === e.request) || responses.has(e.request)) throw new Error("unknown request or duplicate response");
  if (!Number.isFinite(e.at) || e.at < 0 || controlResult(JSON.parse(e.result)) !== e.result) throw new Error("invalid recorded response");
}
