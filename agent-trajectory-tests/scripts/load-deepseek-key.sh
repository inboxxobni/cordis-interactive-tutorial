#!/bin/bash
# Loads DeepSeek credentials for the trajectory-test CLI into env vars,
# without ever echoing the key. Checks, in order:
#   1. A project-local override: agent-trajectory-tests/.env.deepseek.json
#      (gitignored - for a repo-specific key, never committed)
#   2. ~/.secure-storage/llmproviders/deepseek/deepseek.json
# Source this file (`. scripts/load-deepseek-key.sh`), don't execute it, so
# the exported vars land in the calling shell.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LOCAL_KEY_FILE="$SCRIPT_DIR/../.env.deepseek.json"
HOME_KEY_FILE="$HOME/.secure-storage/llmproviders/deepseek/deepseek.json"

if [ -f "$LOCAL_KEY_FILE" ]; then
  KEY_FILE="$LOCAL_KEY_FILE"
elif [ -f "$HOME_KEY_FILE" ]; then
  KEY_FILE="$HOME_KEY_FILE"
else
  echo "No DeepSeek key found at $LOCAL_KEY_FILE or $HOME_KEY_FILE" >&2
  exit 1
fi

export CORDIS_TRAJECTORY_API_KEY
CORDIS_TRAJECTORY_API_KEY="$(node -pe "require('$KEY_FILE').deepseek_api_key")"

export CORDIS_TRAJECTORY_BASE_URL
CORDIS_TRAJECTORY_BASE_URL="$(node -pe "require('$KEY_FILE').deepseek_api_url || ''")"

export CORDIS_TRAJECTORY_MODEL
CORDIS_TRAJECTORY_MODEL="deepseek-flash"

echo "Loaded DeepSeek credentials from $KEY_FILE (model default: $CORDIS_TRAJECTORY_MODEL)" >&2
