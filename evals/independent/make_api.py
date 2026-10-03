"""Write API.md: @solanaut/sdk's exported declarations, without implementation, for black-box evaluators.

    python3 evals/independent/make_api.py <out/API.md>
"""
import re
import sys
from pathlib import Path

SRC = Path(__file__).resolve().parents[2] / "packages/sdk/src"
FILES = ["guard.ts", "log.ts", "record.ts", "policy.ts", "classify.ts", "message.ts", "latch.ts", "sensor.ts",
         "tables.ts", "pda.ts", "base58.ts", "errors.ts", "inspect.ts", "adapters/agent-kit.ts", "adapters/kit.ts",
         "adapters/rpc.ts"]
DATA_CONSTS = {"PROGRAMS", "SENSOR_V1", "VERIFIED_KEEL_DIGEST", "VERIFIED_KEEL_MODULE", "BLOCKHASH_LIFETIME", "RECENT",
               "OUTCOMES", "MAX_LEGACY_TRANSACTION_BYTES", "MAX_V1_TRANSACTION_BYTES", "MAX_V1_ACCOUNTS"}


def depth(s: str) -> int:
    s = re.sub(r'"(\\.|[^"\\])*"|`[^`]*`|\'(\\.|[^\'\\])*\'', "", s)
    s = re.sub(r"//.*", "", s)
    return s.count("{") + s.count("(") + s.count("[") - s.count("}") - s.count(")") - s.count("]")


def skip_body(lines: list[str], i: int, d: int) -> int:
    while d > 0 and i + 1 < len(lines):
        i += 1
        d += depth(lines[i])
    return i


def extract(path: Path) -> list[str]:
    lines = path.read_text().splitlines()
    out, doc, i = [], [], 0
    while i < len(lines):
        ln, st = lines[i], lines[i].strip()
        if st.startswith(("/**", "*", "*/")) or (st.startswith("//") and not ln.startswith(" ")):
            doc.append(ln)
            i += 1
            continue
        m = re.match(r"export (declare )?(interface|type|class|enum|(async )?function|const) (\w+)", ln)
        if not m or ln.startswith(("export {", "export type {")):
            if st:
                doc = []
            i += 1
            continue
        kind, name = m.group(2), m.group(4)
        if kind in ("interface", "class", "enum") or (kind == "type" and not st.endswith(";")) or (kind == "const" and name in DATA_CONSTS):
            block, d = [ln], depth(ln)
            while (d > 0 or (kind == "type" and not block[-1].rstrip().endswith(";"))) and i + 1 < len(lines):
                i += 1
                block.append(lines[i])
                d += depth(lines[i])
            out += doc + block + [""]
        elif kind.endswith("function"):
            sig = ln
            while not (depth(sig) == 1 and sig.rstrip().endswith("{")) and i + 1 < len(lines):
                i += 1
                sig += "\n" + lines[i]
            out += doc + [sig.rstrip()[:-1].rstrip() + ";", ""]
            i = skip_body(lines, i, depth(sig))
        elif kind == "const":
            head = re.match(r"(export const \w+(\s*:\s*[^=]+)?)", ln).group(1).rstrip()
            arrow = re.search(r"=\s*(\([^)]*\)[^=]*=>)", ln)
            out += doc + [head + (f" /* = {arrow.group(1)} … */" if arrow else "") + ";", ""]
            i = skip_body(lines, i, depth(ln))
        else:
            out += doc + [ln, ""]
        doc = []
        i += 1
    return out


parts = ["# @solanaut/sdk: the public API's declarations", "",
         "Generated from the package's exported declarations, with every function body removed. "
         "`import { … } from \"@solanaut/sdk\"`.", "",
         "## index.ts (what the package exports)", "", "```ts", (SRC / "index.ts").read_text().rstrip(), "```"]
for f in FILES:
    body = extract(SRC / f)
    if body:
        parts += ["", f"## {f}", "", "```ts", *body, "```"]
Path(sys.argv[1]).write_text("\n".join(parts) + "\n")
print("API.md:", sum(len(p.splitlines()) for p in parts), "lines")
