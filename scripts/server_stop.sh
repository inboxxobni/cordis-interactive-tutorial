#!/usr/bin/env bash
# Stops whatever these scripts started (foreground or daemon), by killing
# the recorded process GROUPS - not by killing whatever happens to be
# listening on the port. Killing indiscriminately by port took down an
# unrelated project's dev server the one time an earlier version of this
# script did that; ownership matters, "the port is free" is not the goal.
set -eo pipefail
source "$(dirname "${BASH_SOURCE[0]}")/lib.sh"

SERVER_PID="$(read_pid_file "$SERVER_PID_FILE")"
WEB_PID="$(read_pid_file "$WEB_PID_FILE")"

TO_KILL=()
pid_alive "$SERVER_PID" && TO_KILL+=("$SERVER_PID")
pid_alive "$WEB_PID" && TO_KILL+=("$WEB_PID")

if [[ ${#TO_KILL[@]} -eq 0 ]]; then
  echo "[server_stop] nothing running (per $SERVER_PID_FILE / $WEB_PID_FILE)"
else
  echo "[server_stop] stopping process group(s): ${TO_KILL[*]}"
  kill_group_with_guarantee "${TO_KILL[@]}"
fi

rm -f "$SERVER_PID_FILE" "$WEB_PID_FILE"

for entry in "server:$SERVER_PORT" "web:$WEB_PORT"; do
  label="${entry%%:*}" port="${entry##*:}"
  still="$(port_pids "$port")"
  if [[ -n "$still" ]]; then
    echo "[server_stop] note: port $port ($label) is still held by pid(s) $still - not killed, since these scripts didn't start it. Check with 'lsof -i :$port' if that's unexpected." >&2
  fi
done

echo "[server_stop] done"
