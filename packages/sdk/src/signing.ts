// ADR-019: journal facts, not RPC actions. Count this helper in the signer's line budget.
import { encodeBase58 } from "./base58.ts";
import { decodeMessage, decodeTransaction } from "./message.ts";
import { verifyEd25519 } from "./latch.ts";
import type { DecisionEntry } from "./log.ts";

export type SigningEvent =
  | { stage: "signed"; decision: string; wire: string; signature: string }
  | { stage: "send-started"; decision: string; blockHeight: string }
  | { stage: "response"; decision: string; status: "denied" | "sent" | "uncertain"; signature?: string };
export interface SigningHistory {
  decision: DecisionEntry;
  signed?: Extract<SigningEvent, { stage: "signed" }>;
  started?: Extract<SigningEvent, { stage: "send-started" }>;
  response?: Extract<SigningEvent, { stage: "response" }>;
  redeemed?: true;
  settled?: true;
}

/** Validate before append and again during replay, without changing state. */
export function verifySigning(event: SigningEvent, history: SigningHistory | undefined, redeemed: boolean, policyHash: string): void {
  if (!history) throw new Error("signing event names no recorded request decision");
  const { decision: d, signed, started, response } = history;
  if (event.stage === "signed" && !d.allow) throw new Error("signing requires an allowed decision");
  if (response) throw new Error("request already has a durable response");
  if (history.settled && event.stage !== "response") throw new Error("the decision was already reported final");
  if (event.stage === "signed") {
    if (!d.allow) throw new Error("signing requires an allowed decision");
    if (!redeemed) throw new Error("signing requires a durably redeemed receipt");
    if (signed) throw new Error("signed bytes already recorded");
    if (d.policyHash !== policyHash) throw new Error("signing under another policy is refused");
    if (typeof event.wire !== "string") throw new Error("signed wire must be canonical base64");
    const wire = Buffer.from(event.wire, "base64");
    if (wire.toString("base64") !== event.wire) throw new Error("signed wire must be canonical base64");
    let tx: ReturnType<typeof decodeTransaction>;
    try { tx = decodeTransaction(wire); } catch (error) { throw new Error(`invalid signed wire: ${(error as Error).message}`); }
    if (Buffer.from(tx.message).toString("base64") !== d.message) throw new Error("signed bytes differ from admission");
    const decoded = decodeMessage(tx.message);
    const sig = tx.signatures[0];
    if (tx.signatures.length !== 1 || !sig || encodeBase58(sig) !== event.signature || !verifyEd25519(decoded.staticAccounts[0]!, tx.message, sig)) throw new Error("signed wire signature does not verify");
  } else if (event.stage === "send-started") {
    if (!signed) throw new Error("send requires durably signed bytes");
    if (started) throw new Error("send already started; never resend");
    if (d.policyHash !== policyHash) throw new Error("send under another policy is refused");
    if (typeof event.blockHeight !== "string" || !/^(0|[1-9][0-9]*)$/.test(event.blockHeight)) throw new Error("invalid send block height");
    if (!d.expires || BigInt(event.blockHeight) > BigInt(d.expires.lastValidBlockHeight)) throw new Error("send receipt expired or has no bounded lifetime");
  } else if (event.stage === "response") {
    if (event.status === "denied") {
      if (d.allow || event.signature !== undefined) throw new Error("denied response requires a denied decision and no signature");
    } else if (event.status === "sent" || event.status === "uncertain") {
      if (!d.allow || !redeemed) throw new Error("send response requires an allowed redeemed decision");
      if (event.status === "sent" && !started) throw new Error("sent response requires send-started evidence");
      if (event.signature !== signed?.signature) throw new Error("response signature differs from signed evidence");
    } else throw new Error("unsupported signing response status");
  } else throw new Error("unsupported signing stage");
}
