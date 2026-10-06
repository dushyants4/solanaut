import { createGuard, fileStore, verifyPolicyAuthorization, type PolicyAuthorization } from "@solanaut/sdk";
import { lstatSync, realpathSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { createSignerCore, type CoreOptions } from "./core.ts";
import { createClock } from "./clock.ts";
import { createRequestHandler } from "./handler.ts";
import { startSocket } from "./socket.ts";
export interface ServiceOptions { mode: "same-user"; policy: unknown; authorization: PolicyAuthorization; record: string; socket: string; sign: CoreOptions["sign"]; rpc: CoreOptions["rpc"] }
export async function startSigner(options: ServiceOptions) {
  if (options.mode !== "same-user") throw new Error("this host composition requires explicit same-user mode");
  const authorization = Object.freeze({ ...options.authorization }); const policy = verifyPolicyAuthorization(options.policy, authorization);
  const record = resolve(options.record);
  for (const [path, mode, directory] of [[dirname(record), 0o700, true], [record, 0o600, false]] as const) {
    const s = lstatSync(path);
    if (s.uid !== process.getuid?.() || (s.mode & 0o777) !== mode || realpathSync(path) !== path || (directory ? !s.isDirectory() : !s.isFile() || s.nlink !== 1)) throw new Error("history must be protected, owned and real");
  }
  const clock = createClock(); const store = fileStore(record, { ownership: "kernel", create: false });
  const guard = await createGuard({ policy, authorization, log: store, authority: { mode: "same-user", clock: clock.anchor } }).catch((error) => { store.close(); throw error; });
  const core = createSignerCore({ guard, sign: options.sign, rpc: options.rpc, now: clock.now });
  let closing = false; let recoveryIncomplete = false; const work = new Set<Promise<unknown>>();
  const status = () => ({ mode: "same-user", keyIsolation: false, policyHash: guard.policyHash, policyVersion: authorization.version, recoveryIncomplete, ...guard.status() });
  function track<T>(task: Promise<T>): Promise<T> {
    work.add(task); task.then(() => work.delete(task), () => work.delete(task)); return task;
  }
  function recover() {
    if (closing) return Promise.reject(new Error("signer is stopping"));
    return track(core.recover().then((results) => { recoveryIncomplete = results.some((r) => !r.complete); return results; }));
  }
  const handler = createRequestHandler({ guard, core, now: clock.now, status });
  let socket: Awaited<ReturnType<typeof startSocket>>;
  try {
    await recover();
    socket = await startSocket(options.socket, (request) => {
      if (closing) return Promise.reject(new Error("signer is stopping"));
      return track(handler(request));
    });
  } catch (error) { guard.close(); throw error; }
  let stopped: Promise<void> | undefined;
  return { status, recover, close() {
    return stopped ??= (async () => { closing = true; await socket.close(); await Promise.allSettled([...work]); guard.close(); })();
  } };
}
