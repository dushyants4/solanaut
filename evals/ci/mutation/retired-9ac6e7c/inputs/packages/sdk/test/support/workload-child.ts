// The process the restart battery kills: open the guard on its record, which restores it, and run
// the workload from where the record left off. It prints "ack <step>" once each step is recorded
// and synced, and "done" at the end. It is killed with SIGKILL at points the parent picks.
//
//   node packages/sdk/test/support/workload-child.ts <record-path>

import { createGuard } from "../../src/guard.ts";
import { fileStore } from "../../src/record.ts";
import { runFrom, WORKLOAD_POLICY } from "./workload.ts";

const path = process.argv[2];
if (!path) throw new Error("usage: workload-child.ts <record-path>");
const g = await createGuard({ policy: WORKLOAD_POLICY, log: fileStore(path, { ownership: "kernel" }) });
runFrom(g, (i) => process.stdout.write(`ack ${i}\n`));
g.close();
process.stdout.write("done\n");
