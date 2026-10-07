// Publication preflight inventory only; it grants no secret, rights or visibility clearance.
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
export interface HistoryInventory {
  format: 1;
  head: string;
  refs: { name: string; object: string }[];
  commits: { id: string; parents: string[]; tree: string }[];
  blobs: { id: string; size: number; paths: string[]; modes: string[] }[];
  gitlinks: { id: string; paths: string[] }[];
  digest: string;
}
export type GitRead = (args: readonly string[], input?: string) => string;
export function inventoryHistory(repository: string, read?: GitRead): HistoryInventory {
  const env: NodeJS.ProcessEnv = { ...process.env };
  for (const key of Object.keys(env)) if (key.startsWith("GIT_")) delete env[key];
  env.GIT_CONFIG_NOSYSTEM = "1"; env.GIT_CONFIG_GLOBAL = "/dev/null";
  env.GIT_NO_LAZY_FETCH = "1"; env.GIT_OPTIONAL_LOCKS = "0"; env.GIT_GRAFT_FILE = "/dev/null";
  const git: GitRead = read ?? ((args, input) => {
    const result = spawnSync("git", ["--no-replace-objects", "-C", repository, ...args], { input, env, timeout: 30_000, maxBuffer: 32 * 1024 * 1024 });
    if (result.status !== 0 || result.error) throw new Error(`history git read failed: ${args[0]}`);
    return new TextDecoder("utf-8", { fatal: true }).decode(result.stdout);
  });
  if (git(["rev-parse", "--is-shallow-repository"]).trim() !== "false") throw new Error("shallow history cannot be inventoried completely");
  const objectFormat = git(["rev-parse", "--show-object-format"]).trim();
  if (objectFormat !== "sha1" && objectFormat !== "sha256") throw new Error("unsupported Git object format");
  const idPattern = new RegExp(`^[0-9a-f]{${objectFormat === "sha1" ? 40 : 64}}$`);
  const id = (value: string) => { if (!idPattern.test(value)) throw new Error("invalid history object identity"); return value; };
  const scope = () => ({ head: id(git(["rev-parse", "--verify", "HEAD"]).trim()), refs: git(["for-each-ref", "--format=%(refname)%09%(objectname)"]) });
  const before = scope();
  const refs = before.refs.trimEnd().split("\n").filter(Boolean).map(line => {
    const fields = line.split("\t"); if (fields.length !== 2 || !fields[0]!.startsWith("refs/")) throw new Error("invalid history ref");
    return { name: fields[0]!, object: id(fields[1]!) };
  }).sort((a, b) => a.name < b.name ? -1 : a.name > b.name ? 1 : 0);
  if (new Set(refs.map(r => r.name)).size !== refs.length) throw new Error("duplicate history ref");
  const targets = refs.map(ref => {
    try { return id(git(["rev-parse", "--verify", ref.name + "^{commit}"]).trim()); }
    catch { throw new Error("history ref does not resolve to a readable commit: " + ref.name); }
  });
  const commits = git(["rev-list", "--single-worktree", "--parents", "--all", "HEAD"]).trim().split("\n").map(line => {
    const [commit, ...parents] = line.split(" ");
    return { id: id(commit!), parents: parents.map(id), tree: id(git(["rev-parse", "--verify", commit + "^{tree}"]).trim()) };
  }).sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
  const commitIds = new Set(commits.map(c => c.id));
  if (commitIds.size !== commits.length || !commitIds.has(before.head) || targets.some(target => !commitIds.has(target)) || commits.some(c => c.parents.some(parent => !commitIds.has(parent)))) throw new Error("incomplete history commit closure");
  const objects = new Map<string, { paths: Set<string>; modes: Set<string> }>();
  const links = new Map<string, Set<string>>();
  for (const commit of commits) {
    const tree = git(["ls-tree", "-r", "-z", "--full-tree", commit.id]);
    if (tree && !tree.endsWith("\0")) throw new Error("incomplete history tree framing");
    for (const entry of tree.split("\0").filter(Boolean)) {
      const match = /^(100644|100755|120000|160000) (blob|commit) ([0-9a-f]+)\t([\s\S]+)$/.exec(entry);
      if (!match) throw new Error("unsupported history tree entry");
      const [, mode, type, object, path] = match; id(object!);
      if (mode === "160000") {
        if (type !== "commit") throw new Error("invalid history gitlink");
        const paths = links.get(object!) ?? new Set<string>(); paths.add(path!); links.set(object!, paths);
      } else {
        if (type !== "blob") throw new Error("invalid history blob mode");
        const value = objects.get(object!) ?? { paths: new Set<string>(), modes: new Set<string>() };
        value.paths.add(path!); value.modes.add(mode!); objects.set(object!, value);
      }
    }
  }
  const blobIds = [...objects.keys()].sort();
  const metadata = blobIds.length ? git(["cat-file", "--batch-check=%(objectname) %(objecttype) %(objectsize)"], blobIds.join("\n") + "\n").trimEnd().split("\n") : [];
  if (metadata.length !== blobIds.length) throw new Error("incomplete history blob metadata");
  const blobs = metadata.map((line, index) => {
    const fields = line.split(" "); const size = Number(fields[2]);
    if (fields.length !== 3 || fields[0] !== blobIds[index] || fields[1] !== "blob" || !/^(0|[1-9][0-9]*)$/.test(fields[2]!) || !Number.isSafeInteger(size)) throw new Error("missing or invalid history blob object");
    const value = objects.get(fields[0]!)!;
    return { id: fields[0]!, size, paths: [...value.paths].sort(), modes: [...value.modes].sort() };
  });
  const gitlinks = [...links.entries()].sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0).map(([object, paths]) => ({ id: object, paths: [...paths].sort() }));
  if (JSON.stringify(before) !== JSON.stringify(scope())) throw new Error("history refs or HEAD changed during inventory");
  const inventory = { format: 1 as const, head: before.head, refs, commits, blobs, gitlinks };
  return { ...inventory, digest: createHash("sha256").update(JSON.stringify(inventory)).digest("hex") };
}
