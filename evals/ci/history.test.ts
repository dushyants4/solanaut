import { strict as assert } from "node:assert";
import { test } from "node:test";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { chmodSync, mkdirSync, mkdtempSync, readdirSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { inventoryHistory, type GitRead } from "./history.ts";
function fixture(run: (root: string, git: GitRead) => void, format: "sha1" | "sha256" = "sha1") {
  mkdirSync(".sandbox/solanaut-1", { recursive: true });
  const root = mkdtempSync(resolve(".sandbox/solanaut-1/history-fixture-"));
  const git: GitRead = (args, input) => {
    const result = spawnSync("git", ["-C", root, "-c", "core.hooksPath=/dev/null", "-c", "user.name=History fixture", "-c", "user.email=fixture@example.invalid", "-c", "commit.gpgsign=false", ...args], { input, encoding: "utf8", timeout: 10_000 });
    assert.equal(result.status, 0, result.stderr); return result.stdout;
  };
  try {
    git(["init", "-b", "main", "--object-format=" + format]);
    writeFileSync(join(root, "past.txt"), "first\n"); git(["add", "."]); git(["commit", "-m", "first"]);
    run(root, git);
  } finally { rmSync(root, { recursive: true, force: true }); }
}
const blobId = (text: string) => createHash("sha1").update(`blob ${Buffer.byteLength(text)}\0${text}`).digest("hex");
test("PUB-1: inventory retains deleted and changed blobs rather than only HEAD", () => fixture((root, git) => {
  const first = git(["rev-parse", "HEAD"]).trim();
  writeFileSync(join(root, "past.txt"), "second\n"); git(["add", "."]); git(["commit", "-m", "second"]);
  rmSync(join(root, "past.txt")); writeFileSync(join(root, "present.txt"), "present\n"); git(["add", "-A"]); git(["commit", "-m", "removed"]);
  const result = inventoryHistory(root);
  assert.equal(result.head, git(["rev-parse", "HEAD"]).trim()); assert.equal(result.format, 1);
  assert.equal(result.commits.length, 3); assert.ok(result.commits.some(c => c.id === first));
  for (const text of ["first\n", "second\n"]) {
    const old = result.blobs.find(b => b.id === blobId(text)); assert.ok(old);
    assert.deepEqual(old.paths, ["past.txt"]); assert.equal(old.size, Buffer.byteLength(text)); assert.deepEqual(old.modes, ["100644"]);
  }
}));
test("PUB-1: divergent branches and annotated tags are inventoried", () => fixture((root, git) => {
  git(["tag", "-a", "review-base", "-m", "base"]); const tag = git(["rev-parse", "refs/tags/review-base"]).trim();
  git(["checkout", "-b", "candidate"]); writeFileSync(join(root, "branch.txt"), "branch\n"); git(["add", "."]); git(["commit", "-m", "branch"]);
  const branch = git(["rev-parse", "HEAD"]).trim(); git(["checkout", "main"]);
  const result = inventoryHistory(root);
  assert.ok(result.commits.some(c => c.id === branch)); assert.ok(result.blobs.some(b => b.paths.includes("branch.txt")));
  assert.deepEqual(result.refs.map(r => r.name), ["refs/heads/candidate", "refs/heads/main", "refs/tags/review-base"]);
  assert.equal(result.refs.find(r => r.name === "refs/tags/review-base")?.object, tag);
}));
test("PUB-1: tabs, newlines and Unicode paths survive NUL tree framing", () => fixture((root, git) => {
  const name = "µ\tline\n.txt"; writeFileSync(join(root, name), "unusual\n"); git(["add", "."]); git(["commit", "-m", "unusual"]);
  assert.deepEqual(inventoryHistory(root).blobs.find(b => b.id === blobId("unusual\n"))?.paths, [name]);
}));
test("PUB-1: executable, symlink and gitlink modes remain explicit without following links", () => fixture((root, git) => {
  writeFileSync(join(root, "executable"), "execute\n"); chmodSync(join(root, "executable"), 0o755);
  symlinkSync("missing-target", join(root, "link")); git(["add", "."]);
  const target = git(["rev-parse", "HEAD"]).trim(); git(["update-index", "--add", "--cacheinfo", `160000,${target},submodule`]); git(["commit", "-m", "modes"]);
  const result = inventoryHistory(root);
  assert.deepEqual(result.blobs.find(b => b.paths.includes("executable"))?.modes, ["100755"]);
  assert.deepEqual(result.blobs.find(b => b.paths.includes("link"))?.modes, ["120000"]);
  assert.deepEqual(result.gitlinks, [{ id: target, paths: ["submodule"] }]);
}));
test("PUB-1: shallow and incomplete object histories refuse instead of silently shrinking", () => fixture((root, git) => {
  const head = git(["rev-parse", "HEAD"]).trim(); writeFileSync(join(root, ".git", "shallow"), head + "\n");
  assert.throws(() => inventoryHistory(root), /shallow/); rmSync(join(root, ".git", "shallow"));
  const id = blobId("first\n"); rmSync(join(root, ".git", "objects", id.slice(0, 2), id.slice(2)));
  assert.throws(() => inventoryHistory(root), /object|git read/);
}));
test("PUB-1: detached HEAD and stable repeated inventory have explicit scope and digest", () => fixture((root, git) => {
  git(["checkout", "--detach"]); writeFileSync(join(root, "detached.txt"), "detached\n"); git(["add", "."]); git(["commit", "-m", "detached"]);
  const one = inventoryHistory(root), two = inventoryHistory(root);
  assert.deepEqual(one, two); assert.match(one.digest, /^[0-9a-f]{64}$/);
  const { digest, ...contents } = one;
  assert.equal(digest, createHash("sha256").update(JSON.stringify(contents)).digest("hex"));
  assert.ok(one.commits.some(c => c.id === one.head)); assert.ok(one.blobs.some(b => b.paths.includes("detached.txt")));
}));
test("PUB-1: changing refs or HEAD during enumeration refuse", () => fixture((root, git) => {
  let changed = false;
  const read: GitRead = (args, input) => {
    const output = git(args, input);
    if (!changed && args[0] === "ls-tree") { changed = true; git(["update-ref", "refs/heads/new-candidate", "HEAD"]); }
    return output;
  };
  assert.throws(() => inventoryHistory(root, read), /changed/);
}));
test("PUB-1: non-commit refs cannot be ignored as irrelevant history", () => fixture((root, git) => {
  git(["update-ref", "refs/tags/blob-tag", blobId("first\n")]);
  assert.throws(() => inventoryHistory(root), /commit|ref|git read/);
}));
test("PUB-1: ref targets missing from returned commit closure refuse", () => fixture((root, git) => {
  git(["checkout", "-b", "candidate"]); writeFileSync(join(root, "branch.txt"), "branch\n"); git(["add", "."]); git(["commit", "-m", "branch"]); git(["checkout", "main"]);
  const read: GitRead = (args, input) => args[0] === "rev-list" ? git(["rev-list", "--parents", "HEAD"]) : git(args, input);
  assert.throws(() => inventoryHistory(root, read), /closure/);
}));
test("PUB-1: shared blobs retain each historical path and file mode", () => fixture((root, git) => {
  writeFileSync(join(root, "renamed.txt"), "first\n"); chmodSync(join(root, "renamed.txt"), 0o755);
  git(["add", "."]); git(["commit", "-m", "shared"]);
  const shared = inventoryHistory(root).blobs.find(b => b.id === blobId("first\n"));
  assert.deepEqual(shared?.paths, ["past.txt", "renamed.txt"]); assert.deepEqual(shared?.modes, ["100644", "100755"]);
}));
test("PUB-1: malformed tree framing and object metadata refuse", () => {
  for (const variant of ["tree", "size", "count", "truncated", "duplicate"]) fixture((root, git) => {
    if(variant==="truncated"){writeFileSync(join(root,"extra.txt"),"second blob\n");git(["add","."]);git(["commit","-m","extra blob"]);}
    const read: GitRead = (args, input) => {
      const output = git(args, input);
      if (variant === "tree" && args[0] === "ls-tree") return output.slice(0, -1);
      if (variant === "size" && args[0] === "cat-file" && args[1]?.startsWith("--batch-check")) return output.replace(/ blob \d+\n/, " blob 9007199254740992\n");
      if (variant === "count" && args[0] === "cat-file" && args[1]?.startsWith("--batch-check")) return "";
      if (variant === "truncated" && args[0] === "cat-file" && args[1]?.startsWith("--batch-check")) return output.trimEnd().split("\n")[0]+"\n";
      if (variant === "duplicate" && args[0] === "rev-list") return output + output;
      return output;
    };
    assert.throws(() => inventoryHistory(root, read), /history|object/);
  });
});
test("PUB-1: SHA-256 Git repositories retain full object identities", () => fixture((root, git) => {
  const result = inventoryHistory(root); assert.match(result.head, /^[0-9a-f]{64}$/);
  assert.equal(result.head, git(["rev-parse", "HEAD"]).trim());
  const expected = createHash("sha256").update("blob 6\0first\n").digest("hex");
  assert.equal(result.blobs[0]?.id, expected); assert.equal(result.blobs[0]?.size, 6);
}, "sha256"));
test("PUB-1: local grafts cannot hide original commit ancestry", () => fixture((root, git) => {
  writeFileSync(join(root, "past.txt"), "second\n"); git(["add", "."]); git(["commit", "-m", "second"]);
  const head = git(["rev-parse", "HEAD"]).trim(); writeFileSync(join(root, ".git", "info", "grafts"), head + "\n");
  const result = inventoryHistory(root);
  assert.equal(result.commits.length, 2); assert.equal(result.commits.find(c => c.id === head)?.parents.length, 1);
  assert.ok(result.blobs.some(b => b.id === blobId("first\n")));
}));
test("PUB-1: partial-clone inventory refuses missing blobs without lazy fetch or object writes", () => fixture((root, git) => {
  git(["config", "uploadpack.allowFilter", "true"]);
  const partial = join(root, "partial.git"); git(["clone", "--bare", "--no-local", "--filter=blob:none", root, partial]);
  const objects = join(partial, "objects"); const before = readdirSync(objects, { recursive: true }).sort();
  assert.throws(() => inventoryHistory(partial), /object|git read/);
  assert.deepEqual(readdirSync(objects, { recursive: true }).sort(), before);
}));
test("PUB-1: cached commit graphs cannot authorise missing historical commit objects", () => fixture((root, git) => {
  const first = git(["rev-parse", "HEAD"]).trim();
  writeFileSync(join(root, "past.txt"), "second\n"); git(["add", "."]); git(["commit", "-m", "second"]);
  git(["commit-graph", "write", "--reachable"]);
  rmSync(join(root, ".git", "objects", first.slice(0, 2), first.slice(2)));
  assert.throws(() => inventoryHistory(root), /object|history|git read/);
}));
test("PUB-1: commit-body read failure cannot be replaced by graph or tree metadata", () => fixture((root, git) => {
  const firstTree=git(["rev-parse","HEAD^{tree}"]).trim();writeFileSync(join(root,"past.txt"),"second\n");git(["add","."]);git(["commit","-m","second"]);const head=git(["rev-parse","HEAD"]).trim();
  for(const mode of ["missing","corrupt","parent","tree"]){
    const read:GitRead=(args,input)=>{
      if((mode==="missing"||mode==="corrupt")&&args[0]==="cat-file"&&args[1]==="commit"){if(mode==="missing")throw new Error("historical commit object cannot be read");return git(args,input)+"corrupt";}
      if(mode==="parent"&&args[0]==="rev-list")return head+"\n";
      if(mode==="tree"&&args[0]==="rev-parse"&&args[2]===head+"^{tree}")return firstTree+"\n";
      return git(args,input);
    };
    assert.throws(()=>inventoryHistory(root,read),/commit|object|history/);
  }
}));
