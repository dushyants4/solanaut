export function createClock(wall = Date.now, monotonic = process.hrtime.bigint) {
  const origin = monotonic();
  const anchor = Object.freeze({ wall: wall(), monotonicNs: origin.toString() });
  return { anchor, now: () => anchor.wall + Number(monotonic() - origin) / 1_000_000 };
}
