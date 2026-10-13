import { Socket } from "node:net";
import { isAbsolute } from "node:path";
import { decodeBase58 } from "../base58.ts";
import type { SigningEvent } from "../signing.ts";
import type { DenialClass } from "../errors.ts";
export interface SignerRefusal { status: "denied"; ref: number; class: DenialClass }
export type SendingResult = (Extract<SigningEvent, { stage: "response" }> & { status: "sent" | "uncertain" }) | SignerRefusal;
export type ReportResult = { decision: string; outcome: "landed" | "failed" | "expired" | "unresolved" } | SignerRefusal;
export interface SendingClientOptions { socket: string; clientId: string; timeoutMs?: number }
export interface SendingRequest { id: string; deadline?: number }
export type SignerClientCode = "input" | "timeout" | "connection" | "protocol" | "remote";
export class SignerClientError extends Error {
  readonly code: SignerClientCode;
  readonly mayHaveExecuted: boolean;
  readonly remoteCode: string | undefined;
  constructor(code: SignerClientCode, message: string, mayHaveExecuted = false, remoteCode?: string) {
    super(message); this.name = "SignerClientError"; this.code = code; this.mayHaveExecuted = mayHaveExecuted; this.remoteCode = remoteCode;
  }
}
const identity = (value: unknown) => typeof value === "string" && /^[A-Za-z0-9._:-]{1,128}$/.test(value);
const hash = (value: unknown) => typeof value === "string" && /^[0-9a-f]{64}$/.test(value);
const record = (value: unknown) => value !== null && typeof value === "object" && !Array.isArray(value);
function signature(value: unknown): boolean { try { return typeof value === "string" && decodeBase58(value).length === 64; } catch { return false; } }
const refusal = (r: Record<string, unknown>) => r.status === "denied" && typeof r.ref === "number" && Number.isSafeInteger(r.ref) && r.ref >= -1 && ["refused", "retry-later", "invalid"].includes(String(r.class)) && Object.keys(r).every((key) => ["status", "ref", "class"].includes(key));
export function createSendingClient(options: SendingClientOptions) {
  if (!record(options)) throw new SignerClientError("input", "options must be an object");
  const { socket: path, clientId } = options; const timeoutMs = options.timeoutMs ?? 30_000;
  if (typeof path !== "string" || !isAbsolute(path)) throw new SignerClientError("input", "socket must be an absolute path");
  if (!identity(clientId)) throw new SignerClientError("input", "invalid client identity");
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0 || timeoutMs > 30_000) throw new SignerClientError("input", "invalid client timeout");
  function call(method: "propose" | "report" | "status", input: SendingRequest, payload: object): Promise<unknown> {
    if (!record(input) || !identity(input.id)) return Promise.reject(new SignerClientError("input", "invalid request identity"));
    const id = input.id;
    const deadline = input.deadline ?? Date.now() + timeoutMs;
    if (!Number.isFinite(deadline)) return Promise.reject(new SignerClientError("input", "invalid request deadline"));
    const frame = JSON.stringify({ method, clientId, id, deadline, ...payload }) + "\n";
    return new Promise((resolve, reject) => {
      const socket = new Socket(); let buffer = Buffer.alloc(0); let done = false; let written = false;
      const finish = (error: SignerClientError | null, result?: unknown) => {
        if (done) return; done = true; clearTimeout(timer); socket.destroy();
        if (error) reject(error); else resolve(result);
      };
      const fail = (code: SignerClientCode, remoteCode?: string) => finish(new SignerClientError(code, `signer ${code} error`, method === "propose" && written, remoteCode));
      const timer = setTimeout(() => fail("timeout"), timeoutMs);
      socket.once("connect", () => { if (done) return; written = true; socket.write(frame); });
      socket.on("error", () => fail("connection")); socket.once("end", () => fail("connection")); socket.once("close", () => fail("connection"));
      socket.on("data", (chunk) => {
        if (done) return;
        const bytes = typeof chunk === "string" ? Buffer.from(chunk) : chunk;
        if (buffer.length + bytes.length > 16_384) { fail("protocol"); return; }
        buffer = Buffer.concat([buffer, bytes]); const end = buffer.indexOf(10); if (end === -1) return;
        try {
          if (end !== buffer.length - 1) throw new Error("multiple frames");
          const text = new TextDecoder("utf-8", { fatal: true }).decode(buffer.subarray(0, end)); const body = JSON.parse(text);
          if (!body || typeof body !== "object" || Array.isArray(body) || JSON.stringify(body) !== text) throw new Error("invalid envelope");
          if (body.ok === false && typeof body.error?.code === "string") { fail("remote", ["busy", "timeout", "protocol", "method", "internal"].includes(body.error.code) ? body.error.code : "unknown"); return; }
          if (body.ok !== true || body.id !== id || !("result" in body) || Object.keys(body).some((key) => !["ok", "id", "result"].includes(key))) throw new Error("mismatched envelope");
          const r = body.result;
          if (!r || typeof r !== "object" || Array.isArray(r)) throw new Error("invalid result");
          if (method === "propose" && (r.stage !== "response" || !hash(r.decision) || !["sent", "uncertain"].includes(r.status) || (r.status === "sent" ? !signature(r.signature) : r.signature !== undefined && !signature(r.signature)) || Object.keys(r).some((key) => !["stage", "decision", "status", "signature"].includes(key)))) {
            if (!refusal(r)) throw new Error("invalid proposal result");
          }
          if (method === "report" && (r.decision !== (payload as { decision: string }).decision || !["landed", "failed", "expired", "unresolved"].includes(r.outcome) || Object.keys(r).some((key) => !["decision", "outcome"].includes(key)))) {
            if (!refusal(r)) throw new Error("invalid report result");
          }
          finish(null, r);
        } catch { fail("protocol"); }
      });
      try { socket.connect(path); } catch { fail("connection"); }
    });
  }
  return Object.freeze({
    async propose(input: SendingRequest & { message: Uint8Array; group?: string }): Promise<SendingResult> {
      if (!record(input) || !(input.message instanceof Uint8Array) || input.message.length > 6144) throw new SignerClientError("input", "message must be bounded bytes");
      if (input.group !== undefined && (typeof input.group !== "string" || input.group.length > 256)) throw new SignerClientError("input", "group must be bounded text");
      return await call("propose", input, { message: Buffer.from(input.message).toString("base64"), ...(input.group === undefined ? {} : { group: input.group }) }) as SendingResult;
    },
    async report(input: SendingRequest & { decision: string }): Promise<ReportResult> {
      if (!record(input) || !hash(input.decision)) throw new SignerClientError("input", "invalid decision hash");
      return await call("report", input, { decision: input.decision }) as ReportResult;
    },
    async status(input: SendingRequest): Promise<Readonly<Record<string, unknown>>> { return await call("status", input, {}) as Readonly<Record<string, unknown>>; },
  });
}
