import { createTrustedRpc } from "../../src/rpc.ts";
const rpc = createTrustedRpc(["https://a.invalid", "https://b.invalid"], {
  timeoutMs: 30,
  fetch: async (_url, init) => await new Promise<Response>((_resolve, reject) => init?.signal?.addEventListener("abort", () => reject(new Error("deadline abort")), { once: true })),
});
try { await rpc.height(Date.now() + 100); process.exitCode = 1; }
catch { process.stdout.write("bounded deadline completed\n"); }
