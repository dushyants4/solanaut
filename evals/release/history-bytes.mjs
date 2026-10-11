import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { inventoryHistory } from "../ci/history.ts";

export function sensitiveHistoryPath(path) {
  const parts = path.toLowerCase().split("/");
  return parts.includes("keys") || parts.includes("private") || /^(\.env(?:\..*)?|credentials(?:\..*)?|.*\.(pem|keypair\.json))$/.test(parts.at(-1));
}

export function verifyHistoryBytes(repository, manifest, readBlob) {
  const current = inventoryHistory(repository);
  if (JSON.stringify(current) !== JSON.stringify(manifest)) throw new Error("inventory does not match current complete scope");
  if (manifest.gitlinks.length) throw new Error("gitlink target content requires separate review");
  if (manifest.blobs.some(blob => blob.paths.some(sensitiveHistoryPath))) throw new Error("sensitive historical path requires human review before content reads");
  const env = { ...process.env };
  for (const key of Object.keys(env)) if (key.startsWith("GIT_")) delete env[key];
  Object.assign(env, { GIT_CONFIG_NOSYSTEM: "1", GIT_CONFIG_GLOBAL: "/dev/null", GIT_NO_LAZY_FETCH: "1", GIT_OPTIONAL_LOCKS: "0", GIT_GRAFT_FILE: "/dev/null" });
  const read = readBlob ?? (id => {
    const result = spawnSync("git", ["--no-replace-objects", "-C", repository, "cat-file", "blob", id], { env, timeout: 30_000, maxBuffer: 64 * 1024 * 1024 });
    if (result.status !== 0 || result.error) throw new Error("blob read unavailable");
    return result.stdout;
  });
  const rows = [];
  let total = 0;
  for (const blob of manifest.blobs) {
    if (blob.size > 64 * 1024 * 1024) throw new Error("blob read exceeds declared resource bound");
    let bytes;
    try { bytes = read(blob.id); } catch { throw new Error("blob read unavailable"); }
    if (!Buffer.isBuffer(bytes)) throw new Error("blob bytes unavailable");
    if (bytes.length !== blob.size) throw new Error("blob size differs from inventory");
    const algorithm = blob.id.length === 40 ? "sha1" : "sha256";
    const object = createHash(algorithm).update(`blob ${bytes.length}\0`).update(bytes).digest("hex");
    if (object !== blob.id) throw new Error("blob hash differs from inventory");
    const digest = createHash("sha256").update(bytes).digest("hex");
    rows.push({ id: blob.id, size: blob.size, sha256: digest });
    total += bytes.length;
    if (!Number.isSafeInteger(total)) throw new Error("blob byte count exceeds safe integer");
  }
  if (JSON.stringify(inventoryHistory(repository)) !== JSON.stringify(manifest)) throw new Error("history scope changed during content reads");
  return { format: 1, revision: manifest.head, inventoryDigest: manifest.digest, contentDigest: createHash("sha256").update(JSON.stringify(rows)).digest("hex"), blobs: rows.length, bytes: total, skipped: 0, clearance: false, rows };
}
