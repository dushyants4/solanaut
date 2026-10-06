// Test-only owner: persist a selected prefix, acknowledge it, then await process death.
import { createGuard } from "../../packages/sdk/src/guard.ts";
import { fileStore } from "../../packages/sdk/src/record.ts";
import { step, TOTAL_STEPS, WORKLOAD_POLICY } from "../../packages/sdk/test/support/workload.ts";
const [path, value, ...extra] = process.argv.slice(2); const point = Number(value);
if (!path || extra.length || !Number.isInteger(point) || point < 1 || point >= TOTAL_STEPS) throw new Error("invalid kill fixture arguments");
const guard = await createGuard({ policy: WORKLOAD_POLICY, log: fileStore(path, { ownership: "kernel" }) });
for (let index = 0; index < point; index++) step(guard, index);
if (guard.entries().length !== point) throw new Error("kill fixture did not persist its prefix");
setInterval(() => {}, 1000);
process.stdout.write(`ready ${point}\n`);
