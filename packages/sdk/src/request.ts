// ADR-019: the caller payload excludes authoritative time/heights and transport deadlines.
import { canonicalJSON, sha256hex } from "./canonical.ts";
import type { DecisionEntry } from "./log.ts";

export interface RequestIdentity { clientId: string; id: string }
export interface RequestBinding extends RequestIdentity { guardId: string; digest: string }
const valid = (value: unknown): value is string => typeof value === "string" && /^[A-Za-z0-9._:-]{1,128}$/.test(value);
export const requestKey = (r: RequestBinding) => canonicalJSON([r.guardId, r.clientId, r.id]);
export const requestDigest = (message: string, group: string | null) => sha256hex(canonicalJSON({ message, group }));

export function bindRequest(guardId: string, identity: RequestIdentity, message: Uint8Array, group?: string): RequestBinding {
  if (!identity || !valid(identity.clientId) || !valid(identity.id)) throw new Error("invalid request identity");
  if (!(message instanceof Uint8Array) || (group !== undefined && typeof group !== "string")) throw new Error("invalid request payload");
  return Object.freeze({ guardId, clientId: identity.clientId, id: identity.id, digest: requestDigest(Buffer.from(message).toString("base64"), group ?? null) });
}

export function verifyRequest(d: DecisionEntry, guardId: string): void {
  const r = d.request;
  if (!r) return;
  if (r.guardId !== guardId || !valid(r.clientId) || !valid(r.id) || r.digest !== requestDigest(d.message, d.group)) throw new Error("recorded request identity or payload does not verify");
}
