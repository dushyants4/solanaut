// Child: open a guard on a record, say "ready", and hold it until killed.
// argv: <log path>; env POLICY: the policy as JSON with amounts as decimal strings.
import fs from "node:fs";
import { createGuard } from "@solanaut/sdk";

const policy = JSON.parse(process.env.POLICY);
const calm = () => ({ intensity: 0, valence: 0.2, repetition: 0 });
try {
  const guard = await createGuard({ policy, sensor: calm, log: process.argv[2] });
  fs.writeSync(1, `ready ${guard.status().seq}\n`);
  setInterval(() => {}, 1 << 30);
} catch (e) {
  fs.writeSync(1, `refused ${String(e && e.message).replace(/\n/g, " ").slice(0, 200)}\n`);
  process.exit(3);
}
