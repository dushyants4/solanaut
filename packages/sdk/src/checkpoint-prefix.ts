// The record's prefix that a checkpoint covers: a full replay validates its events before their
// signed payload is prepared (ADR-019).
import { canonicalJSON, sha256hex } from "./canonical.ts";
import { replay } from "./guard.ts";
import { EVALUATION_PROFILE } from "./profile.ts";
import { sensorV1 } from "./sensor.ts";
import type { Entry } from "./log.ts";
import type { PolicyTrust } from "./signed-policy.ts";
import { Governor } from "@gubernaut/core";
export class CheckpointPrefixError extends Error {
  readonly code = "checkpoint-prefix";
  constructor(message: string) {
    super(message);
    this.name = "CheckpointPrefixError";
  }
}
export interface PreparedCheckpointPrefix {
  readonly text: string;
  readonly digest: string;
}
/** Internal component: full history validates the prefix before rebuilding a fresh controller. */
export async function rebuildCheckpointPrefix(
  input: unknown,
  policyInput: unknown,
  context: { seq: number; head: string },
  prefixInput: unknown,
  trust?: PolicyTrust,
): Promise<Readonly<{ controller: Governor; events: number; seq: number; head: string }>> {
  try {
    const endpoint = structuredClone(context),
      pins = structuredClone(trust),
      captured = structuredClone(input),
      policy = structuredClone(policyInput);
    if (typeof prefixInput !== "string") throw new CheckpointPrefixError("checkpoint prefix must be canonical text");
    const expected = await prepareCheckpointPrefix(captured, policy, endpoint, pins);
    if (prefixInput !== expected.text)
      throw new CheckpointPrefixError("checkpoint prefix differs from validated full history");
    // Parse the derived bytes only; no controller state from caller input is loaded.
    const prefix = JSON.parse(expected.text),
      controller = await Governor.create();
    for (const event of prefix.events) {
      if (event.kind === "reset") controller.reset();
      else if (controller.tick(event.telemetry).posture !== event.posture)
        throw new CheckpointPrefixError("checkpoint controller replay diverges");
    }
    return Object.freeze({ controller, events: prefix.events.length, ...endpoint });
  } catch (error) {
    if (error instanceof CheckpointPrefixError) throw error;
    throw new CheckpointPrefixError("checkpoint controller cannot be rebuilt");
  }
}
export async function prepareCheckpointPrefix(
  input: unknown,
  policyInput: unknown,
  context: { seq: number; head: string },
  trust?: PolicyTrust,
): Promise<Readonly<PreparedCheckpointPrefix>> {
  try {
    // Capture pins and all inputs before asynchronous controller creation permits caller mutation.
    const endpoint = structuredClone(context);
    if (
      !endpoint ||
      Object.keys(endpoint).sort().join(",") !== "head,seq" ||
      !Number.isSafeInteger(endpoint.seq) ||
      endpoint.seq < 0 ||
      (endpoint.seq === 0
        ? endpoint.head !== ""
        : typeof endpoint.head !== "string" || !/^[0-9a-f]{64}$/.test(endpoint.head))
    )
      throw new CheckpointPrefixError("prefix endpoint is invalid");
    const captured = structuredClone(input),
      policy = structuredClone(policyInput),
      pins = structuredClone(trust);
    if (
      !Array.isArray(captured) ||
      Object.keys(captured).length !== captured.length ||
      !Object.keys(captured).every((key, index) => key === String(index))
    )
      throw new CheckpointPrefixError("prefix history must be a dense ordered array");
    const entries = JSON.parse(canonicalJSON(captured)) as Entry[];
    if (entries.length !== endpoint.seq || (entries.at(-1)?.hash ?? "") !== endpoint.head)
      throw new CheckpointPrefixError("prefix history differs from captured endpoint");
    const result = await replay(entries, policy, sensorV1, pins);
    if (!result.ok) throw new CheckpointPrefixError("prefix history does not reproduce its decisions");
    const events = entries.flatMap((e) =>
      e.kind === "release"
        ? [{ kind: "reset", seq: e.seq, hash: e.hash }]
        : e.kind === "decision" && e.posture !== null && e.telemetry !== null
          ? [{ kind: "tick", seq: e.seq, hash: e.hash, telemetry: e.telemetry, posture: e.posture }]
          : [],
    );
    const text =
      canonicalJSON({
        format: 1,
        kind: "solanaut-checkpoint-keel-prefix",
        profile: EVALUATION_PROFILE,
        ...endpoint,
        events,
      }) + "\n";
    return Object.freeze({ text, digest: sha256hex(text) });
  } catch (error) {
    if (error instanceof CheckpointPrefixError) throw error;
    throw new CheckpointPrefixError("prefix history cannot be validated");
  }
}
