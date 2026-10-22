/** Host attribution, not cryptographic evidence of OS isolation. */
export interface RuntimeAuthority {
  mode: "same-user" | "isolated";
  clock: { wall: number; monotonicNs: string };
}
export function copyAuthority(value: RuntimeAuthority): RuntimeAuthority {
  if (!value || !["same-user", "isolated"].includes(value.mode)) throw new Error("invalid authority mode");
  const clock = value.clock;
  if (
    !clock ||
    !Number.isFinite(clock.wall) ||
    clock.wall < 0 ||
    typeof clock.monotonicNs !== "string" ||
    !/^(0|[1-9][0-9]*)$/.test(clock.monotonicNs)
  )
    throw new Error("invalid authority clock anchor");
  return Object.freeze({
    mode: value.mode,
    clock: Object.freeze({ wall: clock.wall, monotonicNs: clock.monotonicNs }),
  });
}
