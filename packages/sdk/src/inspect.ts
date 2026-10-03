// What a dashboard shows of a guard (ADR-011): computed from its record and policy exactly as a
// restore rebuilds the guard, so the view is what the guard will do, not a second opinion. Plain
// JSON: amounts and heights are decimal strings. Reading a record changes nothing.

import { createPolicy } from "./policy.ts";
import { hashOf, type DecisionEntry, type Entry } from "./log.ts";
import { apply, couldStillLand, initialState, windowTotals } from "./state.ts";

export interface Inspection {
  guardId: string;
  cluster: string;
  policyHash: string;
  /** Entries in the record, and the hash of the last. */
  entries: number;
  head: string;
  latched: { seq: number } | null;
  consecutiveDenials: number;
  /** Intents with an attempt that could still land. */
  inFlight: number;
  /** As the latest decision recorded it. */
  keel: { version: string; verified: string } | null;
  window: {
    windowMs: number;
    sol: { used: string; cap: string };
    fees: { used: string; cap: string };
    tokens: { mint: string; used: string; cap: string }[];
  };
  intents: { key: string; firstAt: number; done: boolean; attempts: { decision: string; status: string; lastValidBlockHeight: string | null }[] }[];
  /** The last 50 decisions, newest first. */
  decisions: {
    seq: number;
    at: number;
    allow: boolean;
    rule: string | null;
    reason: string;
    posture: string | null;
    telemetry: { intensity: number; valence: number; repetition: number } | null;
    sol: string | null;
    fees: string | null;
    /** True on the decision that latched the guard. */
    latch: boolean;
  }[];
  /** The operator's last 20 releases, newest first: each frees the latch at `latchSeq`. */
  releases: { seq: number; at: number; latchSeq: number }[];
  counts: { allow: number; deny: Record<string, number> };
}

export function inspectRecord(entries: readonly Entry[], policyInput: unknown): Inspection {
  const { policy, hash } = createPolicy(policyInput);
  const state = initialState();
  const decisions: DecisionEntry[] = [];
  const releases: { seq: number; at: number; latchSeq: number }[] = [];
  const counts = { allow: 0, deny: {} as Record<string, number> };
  for (const e of entries) {
    if (hashOf(e) !== e.hash) throw new Error(`the record is damaged: the hash of seq ${e.seq} does not match its entry`);
    apply(state, e, policy);
    if (e.kind === "decision") {
      decisions.push(e);
      if (e.allow) counts.allow++;
      else counts.deny[e.rule ?? "unknown"] = (counts.deny[e.rule ?? "unknown"] ?? 0) + 1;
    }
    if (e.kind === "release") releases.push({ seq: e.seq, at: e.at, latchSeq: e.latchSeq });
  }
  const now = state.maxAt ?? 0;
  const lastHeight = [...decisions].reverse().find((d) => d.blockHeight !== null)?.blockHeight ?? null;
  const height = lastHeight === null ? null : BigInt(lastHeight);
  const w = windowTotals(state, policy, now, height);
  const intents = [...state.intents].map(([key, i]) => ({
    key,
    firstAt: i.firstAt,
    done: i.done,
    attempts: i.attempts.map((a) => ({ decision: a.decision, status: a.status, lastValidBlockHeight: a.lastValidBlockHeight?.toString() ?? null })),
  }));
  const latest = decisions.at(-1);
  return {
    guardId: policy.latch.guardId,
    cluster: policy.latch.cluster,
    policyHash: hash,
    entries: entries.length,
    head: state.head,
    latched: state.latched ? { seq: state.latched.seq } : null,
    consecutiveDenials: state.consecutiveDenials,
    inFlight: [...state.intents.values()].filter((i) => !i.done && i.attempts.some((a) => couldStillLand(a, height))).length,
    keel: latest ? { version: latest.keel.version, verified: latest.keel.verified } : null,
    window: {
      windowMs: policy.windowMs,
      sol: { used: w.sol.toString(), cap: policy.sol.maxPerWindow.toString() },
      fees: { used: w.fees.toString(), cap: policy.fees.maxPerWindow.toString() },
      tokens: policy.tokens.map((t) => ({ mint: t.mint, used: (w.tokens.get(t.mint) ?? 0n).toString(), cap: t.maxPerWindow.toString() })),
    },
    intents,
    decisions: decisions.slice(-50).reverse().map((d) => ({
      seq: d.seq,
      at: d.at,
      allow: d.allow,
      rule: d.rule ?? null,
      reason: d.reason,
      posture: d.posture,
      telemetry: d.telemetry,
      sol: d.amounts?.sol ?? null,
      fees: d.amounts?.fees ?? null,
      latch: d.latch === true,
    })),
    releases: releases.slice(-20).reverse(),
    counts,
  };
}
