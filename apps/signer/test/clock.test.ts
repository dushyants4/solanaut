import { strict as assert } from "node:assert";
import { test } from "node:test";
import { createClock } from "../src/clock.ts";
test("SIG-4: clock anchors wall time once and advances only with monotonic time", () => {
  let wall = 1000; let mono = 5000n;
  const clock = createClock(() => wall, () => mono);
  assert.deepEqual(clock.anchor, { wall: 1000, monotonicNs: "5000" });
  wall = -9999; mono += 10_000_000n; assert.equal(clock.now(), 1010);
  wall = 9000; mono += 10_000_000n; assert.equal(clock.now(), 1020);
});
