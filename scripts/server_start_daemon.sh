#!/usr/bin/env bash
# Background/detached run of the full stack. Returns as soon as both sides
# are confirmed healthy; output goes to .run/{server,web}.log.
set -eo pipefail
source "$(dirname "${BASH_SOURCE[0]}")/lib.sh"

existing="$(read_pid_file "$SERVER_PID_FILE")"
if pid_alive "$existing"; then
  echo "Already running (server pid $existing). See scripts/server_status.sh." >&2
  exit 1
fi

cd "$REPO_ROOT"

PORT="$SERVER_PORT" nohup pnpm --filter @cordis-tutorial/server dev > "$SERVER_LOG" 2>&1 &
SERVER_PID=$!
disown "$SERVER_PID" 2>/dev/null || true
echo "$SERVER_PID" > "$SERVER_PID_FILE"

echo "[server_start_daemon] waiting for server on :$SERVER_PORT ..."
if ! wait_for_health "http://localhost:$SERVER_PORT/api/health"; then
  echo "[server_start_daemon] server did not become healthy in time - see $SERVER_LOG" >&2
  kill_group_with_guarantee "$SERVER_PID"
  rm -f "$SERVER_PID_FILE"
  exit 1
fi

# Invoke vite's binary directly, not through `pnpm run dev -- ...`: pnpm's
# arg-forwarding through an intermediate `--` did not reliably reach vite
# (confirmed - --strictPort silently failed to take effect when routed
# through pnpm), so --port/--strictPort must be passed straight to vite.
(cd "$REPO_ROOT/web" && nohup ./node_modules/.bin/vite --port "$WEB_PORT" --strictPort > "$WEB_LOG" 2>&1) &
WEB_PID=$!
disown "$WEB_PID" 2>/dev/null || true
echo "$WEB_PID" > "$WEB_PID_FILE"

echo "[server_start_daemon] waiting for web on :$WEB_PORT ..."
if ! wait_for_health "http://localhost:$WEB_PORT/api/health"; then
  echo "[server_start_daemon] web dev server did not become healthy in time - see $WEB_LOG" >&2
  echo "  (often means port $WEB_PORT is already in use by something else; set CORDIS_TUTORIAL_WEB_PORT to pick another)" >&2
  kill_group_with_guarantee "$SERVER_PID" "$WEB_PID"
  rm -f "$SERVER_PID_FILE" "$WEB_PID_FILE"
  exit 1
fi

echo "[server_start_daemon] running:"
echo "  server pid $SERVER_PID  http://localhost:$SERVER_PORT"
echo "  web    pid $WEB_PID  http://localhost:$WEB_PORT"
echo "  logs: $SERVER_LOG , $WEB_LOG"
