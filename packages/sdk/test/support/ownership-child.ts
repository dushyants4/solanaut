import { fileStore } from "../../src/record.ts";
const store = fileStore(process.argv[2]!, { ownership: "kernel" });
process.stdout.write("ready\n");
setInterval(() => {}, 60_000);
process.on("SIGTERM", () => { store.close(); process.exit(0); });
