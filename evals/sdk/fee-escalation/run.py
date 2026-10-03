# /// script
# requires-python = ">=3.11"
# ///
"""Fee escalation against landed payments (docs/SPEC.md §12; docs/RISKS.md RK20). R&D, not a gate.

Sensor v1 scores "the same shape at higher fees" 0.8 even when the earlier payment landed, so a wallet whose priority
fee drifts between payments reads as escalating. This copies the SDK into .sandbox/fee-exp (gitignored), switches that
one scoring rule by FEE_VARIANT, and runs, per variant:
  - the independent evaluator's batteries (evals/independent/e3-edges/tests/batteries.test.mjs): the loops, benign at a
    constant fee, and benign with varied fees;
  - the SDK's own test suite, against the patched copy.
The SDK in packages/ is not touched.

    uv run --script evals/sdk/fee-escalation/run.py
"""
import json
import os
import re
import shutil
import subprocess
from pathlib import Path

REPO = Path(__file__).resolve().parents[3]
EXP = REPO / ".sandbox/fee-exp"
VARIANTS = {"V1": "sensor v1 as built", "F1": "escalation by shape only against a payment that did not land"}

OLD = "      repetition = Math.max(repetition, fees > prev.fees ? k.repeatEscalating : k.repeatShape);"
NEW = """      // EXPERIMENT (a copy in .sandbox only): FEE_VARIANT=F1 scores escalation only against a payment that did not land.
      const escalating = fees > prev.fees && !(process.env.FEE_VARIANT === "F1" && prev.landed);
      repetition = Math.max(repetition, escalating ? k.repeatEscalating : k.repeatShape);"""


def setup() -> None:
    if EXP.exists():
        shutil.rmtree(EXP)
    EXP.mkdir(parents=True)
    sdk = EXP / "sdk"
    for part in ("src", "test", "bin"):
        if (REPO / "packages/sdk" / part).exists():
            shutil.copytree(REPO / "packages/sdk" / part, sdk / part)
    shutil.copy(REPO / "packages/sdk/package.json", sdk / "package.json")
    # node_modules: every installed package, except @solanaut/sdk, which is the patched copy.
    nm = EXP / "node_modules"
    nm.mkdir()
    for entry in (REPO / "node_modules").iterdir():
        if entry.name == "@solanaut":
            (nm / "@solanaut").mkdir()
            os.symlink(sdk, nm / "@solanaut/sdk")
        else:
            os.symlink(entry, nm / entry.name)
    shutil.copytree(REPO / "evals/independent/e3-edges/tests", EXP / "e3/tests")
    sensor = sdk / "src/sensor.ts"
    text = sensor.read_text()
    if text.count(OLD) != 1:
        raise SystemExit("the escalation rule in packages/sdk/src/sensor.ts has changed: update this experiment before trusting it")
    sensor.write_text(text.replace(OLD, NEW))


def run(variant: str) -> dict:
    env = {**os.environ, "FEE_VARIANT": variant}
    subprocess.run(["node", "--test", "e3/tests/batteries.test.mjs"], cwd=EXP, env=env, capture_output=True, text=True)
    b = json.loads((EXP / "e3/results/batteries.json").read_text())
    suite = subprocess.run("node --test sdk/test/*.test.ts", shell=True, cwd=EXP, env=env, capture_output=True, text=True).stdout
    passed = int(re.search(r"^ℹ pass (\d+)", suite, re.M).group(1))
    failed = int(re.search(r"^ℹ fail (\d+)", suite, re.M).group(1))
    failing = sorted(set(re.findall(r"^✖ (.+?) \(\d", suite, re.M)))
    return {"batteries": b, "suite": (passed, failed, failing)}


def stop(loop: dict) -> str:
    s = (loop.get("attemptsCap3") or loop).get("stop")
    return f"turn {s['turn']} ({s['rule']})" if s else f"not stopped in {(loop.get('attemptsCap3') or loop).get('turnsRun')}"


def main() -> None:
    setup()
    rows = {v: run(v) for v in VARIANTS}
    print("| | " + " | ".join(f"{v}: {d}" for v, d in VARIANTS.items()) + " |")
    print("|---|" + "---|" * len(VARIANTS))
    line = lambda label, f: print(f"| {label} | " + " | ".join(f(rows[v]) for v in VARIANTS) + " |")
    line("identical failing retries", lambda r: stop(r["batteries"]["loopIdentical"]))
    line("rising fees, failing", lambda r: stop(r["batteries"]["loopRisingFees"]))
    line("two shapes alternating", lambda r: stop(r["batteries"]["loopAlternating"]))
    for key, label in (("benignPoisson", "benign, constant fee, 600 at the expected rate"), ("benignBursts", "benign, constant fee, 600 in bursts")):
        line(label, lambda r, key=key: f"{r['batteries'][key]['falseStops']} of {r['batteries'][key]['n']}")
    line("benign, varied fees, 5 × 600", lambda r: "{falseStops} of {n} ({p:.2%}, 95% interval {lo:.2%}–{hi:.2%})".format(
        p=r["batteries"]["benignVariedFees"]["aggregate"]["rate"], lo=r["batteries"]["benignVariedFees"]["aggregate"]["ci95"][0],
        hi=r["batteries"]["benignVariedFees"]["aggregate"]["ci95"][1], **r["batteries"]["benignVariedFees"]["aggregate"]))
    line("the SDK's own suite", lambda r: f"{r['suite'][0]} pass, {r['suite'][1]} fail" + (": " + "; ".join(r["suite"][2]) if r["suite"][2] else ""))


if __name__ == "__main__":
    main()
