#!/bin/bash
# Full Volume 2 (Parts 5-6, chapters 16-24) trajectory test run against a
# real, already-running tutorial server (`pnpm dev` / `pnpm dev:daemon`
# from the repo root), using a real DeepSeek key. Runs every chapter's
# chain through ONE continuous session (see runner.ts's
# runVolumeSequential) so agentLoop can actually reach ACTIVE by chapter
# 22, same as a real user never reconnecting mid-volume. Extra args pass
# through, e.g.: scripts/run-volume-2.sh --chapter 22-providers --timeout-ms 180000
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
. "$SCRIPT_DIR/load-deepseek-key.sh"

cd "$SCRIPT_DIR/.."
exec pnpm exec tsx src/cli.ts \
  --volume 2 \
  --provider deepseek \
  --model "$CORDIS_TRAJECTORY_MODEL" \
  --base-url "$CORDIS_TRAJECTORY_BASE_URL" \
  "$@"
