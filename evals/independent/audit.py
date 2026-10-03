"""Black-box audit of an evaluator subagent: did any of its tool calls read the implementation or the repository?

Reads the subagent's JSONL transcript and keeps only its own tool calls, never tool results, so a stack trace that
prints a source path is not a hit. It flags:
- a read, search or listing that names the repository or node_modules/@solanaut;
- a write outside the evaluator's own folder.
It prints counts and each hit, never the transcript.

    python3 evals/independent/audit.py <folder> <transcript.jsonl>
    python3 evals/independent/audit.py --selftest
"""
import json
import re
import sys
import tempfile

FORBIDDEN = re.compile(r"(/home/dashy/Projects/Solanaut(?!/node_modules/(?!@solanaut)))|node_modules/@solanaut|packages/sdk")


def audit(folder: str, lines) -> tuple[int, dict, list[str]]:
    folder = folder.rstrip("/")
    calls, kinds, hits = 0, {}, []
    for line in lines:
        try:
            rec = json.loads(line)
        except ValueError:
            continue
        msg = rec.get("message") or {}
        if msg.get("role") != "assistant" or not isinstance(msg.get("content"), list):
            continue
        for block in msg["content"]:
            if not isinstance(block, dict) or block.get("type") != "tool_use":
                continue
            calls += 1
            name, inp = block.get("name", "?"), block.get("input") or {}
            kinds[name] = kinds.get(name, 0) + 1
            if name in ("Write", "Edit", "NotebookEdit"):
                path = inp.get("file_path", "")
                if not path.startswith(folder + "/"):
                    hits.append(f"{name} outside its folder: {path}")
                continue
            text = inp.get("command", "") if name == "Bash" else json.dumps(inp)
            if FORBIDDEN.search(text):
                hits.append(f"{name}: {text[:220]}")
    return calls, kinds, hits


def selftest() -> int:
    F = tempfile.mkdtemp()
    call = lambda n, i: json.dumps({"message": {"role": "assistant", "content": [{"type": "tool_use", "name": n, "input": i}]}})
    cases = [
        (call("Read", {"file_path": f"{F}/SPEC.md"}), 0),
        (call("Read", {"file_path": f"{F}/node_modules/@solanaut/sdk/src/guard.ts"}), 1),
        (call("Bash", {"command": "cat /home/dashy/Projects/Solanaut/packages/sdk/src/state.ts"}), 1),
        (call("Bash", {"command": f"cd {F} && node --test tests/"}), 0),
        (call("Read", {"file_path": "/home/dashy/Projects/Solanaut/node_modules/@solana/kit/README.md"}), 0),
        (call("Grep", {"pattern": "couldStillLand", "path": "/home/dashy/Projects/Solanaut"}), 1),
        (call("Write", {"file_path": "/home/dashy/Projects/Solanaut/evals/x.md", "content": "x"}), 1),
        (call("Write", {"file_path": f"{F}/tests/a.test.mjs", "content": "x"}), 0),
        (json.dumps({"message": {"role": "user", "content": [{"type": "tool_result", "content": "at /home/dashy/Projects/Solanaut/packages/sdk/src/guard.ts:12"}]}}), 0),
    ]
    bad = 0
    for line, want in cases:
        got = len(audit(F, [line])[2])
        bad += got != want
        print(f"  [{'PASS' if got == want else 'FAIL'}] expected {want} hit(s), got {got}: {line[:90]}")
    print(f"audit selftest: {len(cases) - bad}/{len(cases)}")
    return 1 if bad else 0


if __name__ == "__main__":
    if sys.argv[1:] == ["--selftest"]:
        sys.exit(selftest())
    folder, transcript = sys.argv[1], sys.argv[2]
    with open(transcript, errors="replace") as fh:
        calls, kinds, hits = audit(folder, fh)
    print(f"{folder.rstrip('/').rsplit('/', 1)[-1]}: {calls} tool calls {dict(sorted(kinds.items()))}; black-box hits: {len(hits)}")
    for h in hits:
        print("   HIT:", h)
    sys.exit(1 if hits else 0)
