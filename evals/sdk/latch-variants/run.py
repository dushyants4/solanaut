# /// script
# requires-python = ">=3.11"
# ///
"""The latch experiment (docs/SPEC.md §12; design/ADR-012). Reproduces evals/sdk/latch-variants.md.

It copies the SDK into .sandbox/latch-exp (gitignored), switches the latch-trip rule there by
LATCH_VARIANT, and runs measure.mts once per variant. The SDK in packages/ is not touched.

    uv run --script evals/sdk/latch-variants/run.py
"""
import json
import os
import shutil
import subprocess
from pathlib import Path

REPO = Path(__file__).resolve().parents[3]
EXP = REPO / ".sandbox/latch-exp"
VARIANTS = ["V0", "A", "B", "C"]

OLD = """  const trips = !body.allow && !state.latched && (state.consecutiveDenials + 1 >= policy.latch.afterDenials || body.posture === "REGROUND");
  return trips ? { ...body, latch: true } : body;"""
NEW = """  // EXPERIMENT (a copy in .sandbox only): when does a REGROUND denial latch?
  const s = state as GuardState & { prevRegroundDenial?: boolean };
  const variant = process.env.LATCH_VARIANT ?? "V0";
  const reground = body.posture === "REGROUND";
  const keelDecides = body.rule === "loop-reground";
  const regroundTrips = !reground ? false : variant === "V0" ? true : variant === "A" ? keelDecides : variant === "B" ? !!s.prevRegroundDenial : keelDecides || !!s.prevRegroundDenial;
  const trips = !body.allow && !state.latched && (state.consecutiveDenials + 1 >= policy.latch.afterDenials || regroundTrips);
  s.prevRegroundDenial = !body.allow && reground;
  return trips ? { ...body, latch: true } : body;"""


def setup() -> None:
    if EXP.exists():
        shutil.rmtree(EXP)
    (EXP / "sdk/test").mkdir(parents=True)
    shutil.copytree(REPO / "packages/sdk/src", EXP / "sdk/src")
    shutil.copy(REPO / "packages/sdk/package.json", EXP / "sdk/package.json")
    shutil.copytree(REPO / "packages/sdk/test/support", EXP / "sdk/test/support")
    shutil.copy(Path(__file__).with_name("measure.mts"), EXP / "measure.mts")
    os.symlink(REPO / "node_modules", EXP / "node_modules")
    guard = EXP / "sdk/src/guard.ts"
    text = guard.read_text()
    if text.count(OLD) != 1:
        raise SystemExit("the latch-trip rule in packages/sdk/src/guard.ts has changed: update this experiment before trusting it")
    guard.write_text(text.replace(OLD, NEW))


def main() -> None:
    setup()
    rows: dict[str, dict[str, dict]] = {}
    for v in VARIANTS:
        out = subprocess.run(["node", "measure.mts"], cwd=EXP, env={**os.environ, "LATCH_VARIANT": v}, capture_output=True, text=True, check=True).stdout
        for line in out.splitlines():
            if line.startswith("{"):
                d = json.loads(line)
                rows.setdefault(d["case"], {})[v] = d
    print("| Stream | " + " | ".join(VARIANTS) + " |")
    print("|---|" + "---|" * len(VARIANTS))
    for case, by in rows.items():
        cells = []
        for v in VARIANTS:
            d = by[v]
            latch = "no latch" if d["latchTurn"] == "-" else f"latch at {d['latchTurn']}"
            stopped = "" if d["legitStopped"] == "-" else f"; legit stopped {d['legitStopped']}"
            cells.append(f"{latch}; allowed {d['allowed']}{stopped}")
        print(f"| {case} | " + " | ".join(cells) + " |")


if __name__ == "__main__":
    main()
