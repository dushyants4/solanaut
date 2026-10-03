#!/bin/bash
# Build black-box evaluator folders outside the repository, where a reboot does not clear them.
# Each gets the spec, the API's declarations and the installed packages, and nothing else from the repo.
#
# usage: bash evals/independent/setup.sh <name> ...      (folders land in ~/.cache/solanaut/eval/<name>)
set -euo pipefail
REPO=$(cd "$(dirname "$0")/../.." && pwd)
BASE=${SOLANAUT_EVAL_DIR:-$HOME/.cache/solanaut/eval}
for name in "$@"; do
  d="$BASE/$name"
  mkdir -p "$d/tests"
  cp "$REPO/docs/SPEC.md" "$d/SPEC.md"
  python3 "$REPO/evals/independent/make_api.py" "$d/API.md" >/dev/null
  ln -sfn "$REPO/node_modules" "$d/node_modules"
  printf '{"name":"eval-%s","private":true,"type":"module"}\n' "$name" > "$d/package.json"
  echo "$d"
done
