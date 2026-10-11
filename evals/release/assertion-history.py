"""Metadata-only inventory for the separate human/Claude assertion review."""
import argparse
import json
import re
import subprocess
from pathlib import Path

root = Path(__file__).resolve().parents[2]
test_name = re.compile(r"\.test\.(?:ts|mjs|js)$")

def git(repo, *arguments):
    result = subprocess.run(["git", "--no-replace-objects", *arguments], cwd=repo,
                            capture_output=True, timeout=30)
    if result.returncode:
        raise ValueError("Git metadata read failed")
    return result.stdout

def bounded(path):
    if any(ord(character) < 32 for character in path) or ".." in Path(path).parts:
        raise ValueError("invalid test path")
    return (path.startswith("packages/sdk/test/") or path.startswith("evals/")
            or re.match(r"^apps/[^/]+/test/", path) is not None)

def regular(repo, revision, path):
    record = git(repo, "ls-tree", "-z", revision, "--", path).split(b"\0")
    if len(record) != 2 or not record[0]:
        raise ValueError("test metadata missing")
    header, listed = record[0].split(b"\t", 1)
    mode, kind, _ = header.split()
    if listed.decode() != path or mode not in (b"100644", b"100755") or kind != b"blob":
        raise ValueError("test object is not a regular blob")

def inventory(repo, baseline, head):
    for pin in (baseline, head):
        if re.fullmatch(r"[0-9a-f]{40}", pin) is None:
            raise ValueError("require exact SHA-1 commit pins")
        if git(repo, "rev-parse", "--verify", pin + "^{commit}").decode().strip() != pin:
            raise ValueError("commit pin differs")
    git(repo, "merge-base", "--is-ancestor", baseline, head)
    commits = git(repo, "rev-list", "--reverse", "--topo-order", baseline + ".." + head).decode().splitlines()
    edges = []
    counts = {"A": 0, "M": 0, "D": 0, "T": 0}
    for commit in commits:
        parents = git(repo, "show", "-s", "--format=%P", commit).decode().split()
        if not parents:
            raise ValueError("post-baseline commit has no parent")
        for parent in parents:
            fields = git(repo, "diff-tree", "-r", "--no-renames", "--name-status", "-z", parent, commit).split(b"\0")
            if fields[-1] != b"" or (len(fields) - 1) % 2:
                raise ValueError("incomplete change metadata")
            for index in range(0, len(fields) - 1, 2):
                status, path = fields[index].decode(), fields[index + 1].decode()
                if not test_name.search(path):
                    continue
                if not bounded(path):
                    raise ValueError("test path outside bounded roots")
                if status not in counts:
                    raise ValueError("unsupported test change status")
                if status != "A":
                    regular(repo, parent, path)
                if status != "D":
                    regular(repo, commit, path)
                counts[status] += 1
                edges.append({"parent": parent, "commit": commit, "status": status, "path": path,
                              "review": "pending content and assertion reason review"})
    return {"format": 1, "baseline": baseline, "head": head, "commits": commits,
            "edges": edges, "counts": counts, "fileBlobsRead": False,
            "assertionEditsReviewed": False, "publicHistoryCleared": False,
            "scope": "all parent edges for named Node test files in SDK/app test roots and evals; not every executable battery or public history"}

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--repo", default=str(root))
    parser.add_argument("--baseline", required=True)
    parser.add_argument("--head", required=True)
    args = parser.parse_args()
    repo = Path(args.repo).resolve()
    if repo != root and not repo.is_relative_to(root / ".sandbox"):
        raise ValueError("repository outside workspace fixture scope")
    print(json.dumps(inventory(repo, args.baseline, args.head), indent=2))

if __name__ == "__main__":
    main()
