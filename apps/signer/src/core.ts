import { decodeMessage, encodeBase58, type Decision, type Guard, type Outcome, type SigningEvent } from "@solanaut/sdk";
import { bindRequest, requestKey } from "../../../packages/sdk/src/request.ts";
export interface CoreOptions {
  guard: Guard;
  sign(message: Uint8Array): Promise<Uint8Array>;
  rpc: {
    observe(message: Uint8Array, deadline: number): Promise<{ height: bigint; lastValidBlockHeight: bigint }>;
    height(deadline: number): Promise<bigint>;
    send(wire: Uint8Array, deadline: number): Promise<string>;
    outcome(signature: string, deadline: number): Promise<Outcome | null>;
  };
  now(): number;
}
export interface Proposal { clientId: string; id: string; deadline: number; message: string; group?: string }
type Response = Extract<SigningEvent, { stage: "response" }>;
export function createSignerCore(options: CoreOptions) {
  const { guard, rpc, now } = options;
  const pending = new Map<string, { digest: string; promise: Promise<Response> }>();
  const evidence = (decision: string) => {
    const events = guard.entries().filter((e) => e.kind === "signing" && e.event.decision === decision);
    const signed = events.find((e) => e.kind === "signing" && e.event.stage === "signed");
    const response = events.find((e) => e.kind === "signing" && e.event.stage === "response");
    return { signed: signed?.kind === "signing" && signed.event.stage === "signed" ? signed.event : undefined,
      response: response?.kind === "signing" && response.event.stage === "response" ? response.event : undefined,
      started: events.some((e) => e.kind === "signing" && e.event.stage === "send-started"),
      redeemed: guard.entries().some((e) => e.kind === "redeem" && e.decision === decision) };
  };
  const answer = (d: Decision, status: Response["status"], signature?: string): Response => {
    const event: Response = { stage: "response", decision: d.hash, status, ...(signature === undefined ? {} : { signature }) };
    guard.recordSigning(event); return event;
  };
  const deadline = (value: number) => {
    if (!Number.isFinite(value) || value <= now() || value > now() + 30_000) throw new Error("request deadline must be future and at most 30 seconds ahead");
  };
  async function execute(request: Proposal, message: Uint8Array, original?: Decision): Promise<Response> {
    let d = original;
    if (d) {
      const old = evidence(d.hash);
      if (old.response) return old.response;
      if (old.started) return answer(d, "uncertain", old.signed!.signature);
    }
    deadline(request.deadline);
    if (!d) {
      const observation = await rpc.observe(message, request.deadline);
      deadline(request.deadline);
      d = guard.check({ message, at: now(), blockHeight: observation.height, lastValidBlockHeight: observation.lastValidBlockHeight, ...(request.group === undefined ? {} : { intent: request.group }) }, request);
      if (d.seq < 0) throw new Error(d.reason);
    }
    if (!d.allow) return answer(d, "denied");
    let old = evidence(d.hash);
    if (!old.signed) {
      if (old.redeemed) return answer(d, "uncertain"); // A crash may have lost signed bytes; never sign again.
      const height = await rpc.height(request.deadline); deadline(request.deadline);
      const receipt = guard.redeem(message, d.hash, height);
      if (!receipt.ok) throw new Error(`receipt refused: ${receipt.reason}`);
      let signature: Uint8Array;
      try { signature = await options.sign(message); }
      catch { return answer(d, "uncertain"); }
      const wire = decodeMessage(message).version === 1 ? Buffer.concat([message, signature]) : Buffer.concat([Buffer.from([1]), signature, message]);
      guard.recordSigning({ stage: "signed", decision: d.hash, wire: wire.toString("base64"), signature: encodeBase58(signature) });
      old = evidence(d.hash);
    }
    const signed = old.signed!;
    const height = await rpc.height(request.deadline); deadline(request.deadline);
    guard.recordSigning({ stage: "send-started", decision: d.hash, blockHeight: height.toString() });
    let returned: string;
    try { returned = await rpc.send(Buffer.from(signed.wire, "base64"), request.deadline); }
    catch { return answer(d, "uncertain", signed.signature); }
    return answer(d, returned === signed.signature ? "sent" : "uncertain", signed.signature);
  }
  async function propose(input: Proposal): Promise<Response> {
    const request = Object.freeze({ ...input });
    if (typeof request.message !== "string" || request.message.length > 8192) throw new Error("message must be bounded canonical base64");
    const message = Buffer.from(request.message, "base64");
    if (message.toString("base64") !== request.message) throw new Error("message must be canonical base64");
    const binding = bindRequest(guard.policy.latch.guardId, request, message, request.group);
    const key = requestKey(binding);
    const old = guard.entries().find((e): e is Decision => e.kind === "decision" && e.request !== undefined && requestKey(e.request) === key);
    if (old && old.request!.digest !== binding.digest) throw new Error("request identity reused with different payload");
    const active = pending.get(key);
    if (active) { if (active.digest !== binding.digest) throw new Error("request identity reused with different payload"); return active.promise; }
    const promise = execute(request, message, old);
    pending.set(key, { digest: binding.digest, promise });
    try { return await promise; } finally { pending.delete(key); }
  }
  async function report(decision: string, requestDeadline = now() + 30_000): Promise<void> {
    const d = guard.entries().find((e): e is Decision => e.kind === "decision" && e.hash === decision && e.allow);
    if (!d) throw new Error("unknown allowed decision");
    if (guard.entries().some((e) => e.kind === "report" && e.decision === decision && e.outcome !== "unknown")) return;
    const signed = evidence(decision).signed;
    if (!signed) return;
    deadline(requestDeadline);
    const outcome = await rpc.outcome(signed.signature, requestDeadline); deadline(requestDeadline);
    if (outcome && outcome !== "unknown" && !guard.entries().some((e) => e.kind === "report" && e.decision === decision && e.outcome !== "unknown")) guard.report(decision, outcome);
  }
  async function recover(): Promise<void> {
    for (const e of guard.entries()) if (e.kind === "decision" && e.request) {
      await propose({ clientId: e.request.clientId, id: e.request.id, message: e.message, ...(e.group === null ? {} : { group: e.group }), deadline: now() + 30_000 });
      if (e.allow) await report(e.hash);
    }
  }
  return { propose, recover, report };
}
