#!/usr/bin/env bash
# Foreground run of the full stack (server + web). Ctrl-C stops both cleanly.
# For a background/detached run, use server_start_daemon.sh instead.
set -eo pipefail
source "$(dirname "${BASH_SOURCE[0]}")/lib.sh"

existing="$(read_pid_file "$SERVER_PID_FILE")"
if pid_alive "$existing"; then
  echo "Already running (server pid $existing). Run scripts/server_status.sh or scripts/server_stop.sh first." >&2
  exit 1
fi

cd "$REPO_ROOT"

PORT="$SERVER_PORT" pnpm --filter @cordis-tutorial/server dev &
SERVER_PID=$!
echo "$SERVER_PID" > "$SERVER_PID_FILE"

cleanup() {
  kill_group_with_guarantee "$(read_pid_file "$SERVER_PID_FILE")" "$(read_pid_file "$WEB_PID_FILE")"
  rm -f "$SERVER_PID_FILE" "$WEB_PID_FILE"
}
trap cleanup EXIT INT TERM

echo "[server_start] waiting for server on :$SERVER_PORT ..."
if ! wait_for_health "http://localhost:$SERVER_PORT/api/health"; then
  echo "[server_start] server did not become healthy in time" >&2
  exit 1
fi
echo "[server_start] server ready: http://localhost:$SERVER_PORT"

# Invoke vite's binary directly, not through `pnpm run dev -- ...`: pnpm's
# arg-forwarding through an intermediate `--` did not reliably reach vite
# (confirmed - --strictPort silently failed to take effect when routed
# through pnpm), so --port/--strictPort must be passed straight to vite.
(cd "$REPO_ROOT/web" && ./node_modules/.bin/vite --port "$WEB_PORT" --strictPort) &
WEB_PID=$!
echo "$WEB_PID" > "$WEB_PID_FILE"
echo "[server_start] web starting: http://localhost:$WEB_PORT"

wait "$SERVER_PID" "$WEB_PID"
