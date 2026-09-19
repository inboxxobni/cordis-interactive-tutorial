#!/bin/bash
# Full Volume 1 (Parts 1-4, chapters 01-15) trajectory test run against a
# real, already-running tutorial server (`pnpm dev` / `pnpm dev:daemon`
# from the repo root), using a real DeepSeek key. Extra args pass through,
# e.g.: scripts/run-volume-1.sh --chapter 03-services --timeout-ms 180000
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
. "$SCRIPT_DIR/load-deepseek-key.sh"

cd "$SCRIPT_DIR/.."
exec pnpm exec tsx src/cli.ts \
  --volume 1 \
  --provider deepseek \
  --model "$CORDIS_TRAJECTORY_MODEL" \
  --base-url "$CORDIS_TRAJECTORY_BASE_URL" \
  "$@"
