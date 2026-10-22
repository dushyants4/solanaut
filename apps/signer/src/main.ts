// The signer's command: --same-user --config <file> [--init]. It reads a protected configuration,
// checks its exact fields, and starts the service on devnet.

import { closeSync, constants, fsyncSync, lstatSync, openSync, realpathSync } from "node:fs";
import { dirname, isAbsolute, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { createGuard, fileStore, verifyPolicyAuthorization, type PolicyAuthorization } from "@solanaut/sdk";
import { loadDevnetKey } from "./key.ts";
import { readProtectedJSON } from "./protected-file.ts";
import { createTrustedRpc } from "./rpc.ts";
import { startSigner } from "./service.ts";
const USAGE = "usage: node apps/signer/src/main.ts --same-user --config <absolute-config> [--init]";
class UsageError extends Error {}
export async function runSigner(args: readonly string[], env: NodeJS.ProcessEnv) {
  if (
    (args.length !== 3 && args.length !== 4) ||
    args[0] !== "--same-user" ||
    args[1] !== "--config" ||
    (args.length === 4 && args[3] !== "--init")
  )
    throw new UsageError(USAGE);
  const input = readProtectedJSON(args[2]!, 0o600, 131_072);
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new Error();
  const config = input as Record<string, unknown>;
  if (
    Object.keys(config).sort().join(",") !== "authorization,cluster,keypair,policy,record,socket" ||
    config.cluster !== "devnet"
  )
    throw new Error();
  for (const name of ["keypair", "record", "socket"])
    if (typeof config[name] !== "string" || !isAbsolute(config[name]) || resolve(config[name]) !== config[name])
      throw new Error();
  const authorization = config.authorization as PolicyAuthorization;
  const policy = verifyPolicyAuthorization(config.policy, authorization),
    key = loadDevnetKey(config.keypair as string);
  if (policy.principal.length !== 1 || policy.principal[0] !== key.address) throw new Error();
  const record = config.record as string;
  if (args[3] === "--init") {
    const parent = dirname(record),
      directory = lstatSync(parent);
    if (
      !directory.isDirectory() ||
      directory.uid !== process.getuid?.() ||
      (directory.mode & 0o777) !== 0o700 ||
      realpathSync(parent) !== parent
    )
      throw new Error();
    const fd = openSync(
      record,
      constants.O_CREAT | constants.O_EXCL | constants.O_WRONLY | constants.O_NOFOLLOW,
      0o600,
    );
    try {
      fsyncSync(fd);
    } finally {
      closeSync(fd);
    }
    const dir = openSync(parent, constants.O_RDONLY | constants.O_DIRECTORY);
    try {
      fsyncSync(dir);
    } finally {
      closeSync(dir);
    }
    const store = fileStore(record, { ownership: "kernel", create: false });
    const guard = await createGuard({ policy, authorization, log: store }).catch((error) => {
      store.close();
      throw error;
    });
    guard.close();
    return undefined;
  }
  const urls = [env.SOLANAUT_RPC_A, env.SOLANAUT_RPC_B];
  if (!urls.every((url) => typeof url === "string" && url.length > 0)) throw new Error();
  const rpc = createTrustedRpc(urls as string[]);
  return await startSigner({
    mode: "same-user",
    policy,
    authorization,
    record,
    socket: config.socket as string,
    sign: key.sign,
    rpc,
  });
}
export function announceSigner(
  service: Awaited<ReturnType<typeof runSigner>>,
  signals: Pick<NodeJS.Process, "once" | "removeListener"> = process,
  write: (text: string) => void = console.log,
) {
  if (!service) {
    write('{"status":"initialised"}');
    return;
  }
  write('{"status":"ready","mode":"same-user","keyIsolation":false}');
  const stop = () => {
    service.close().then(
      () => {
        signals.removeListener("SIGTERM", stop);
        signals.removeListener("SIGINT", stop);
      },
      () => {
        process.exitCode = 1;
      },
    );
  };
  signals.once("SIGTERM", stop);
  signals.once("SIGINT", stop);
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  if (process.argv.length === 3 && process.argv[2] === "--help") console.log(USAGE);
  else
    runSigner(process.argv.slice(2), process.env)
      .then((service) => announceSigner(service))
      .catch((error) => {
        console.error(error instanceof UsageError ? USAGE : "signer startup refused");
        process.exitCode = error instanceof UsageError ? 2 : 1;
      });
}
