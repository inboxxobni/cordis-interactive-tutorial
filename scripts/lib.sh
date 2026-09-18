#!/usr/bin/env bash
# Shared helpers for server_*.sh. Not meant to be run directly - source it.
set -eo pipefail
set -m # job control: each `cmd &` below becomes its own process group leader

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
RUN_DIR="$REPO_ROOT/.run"
SERVER_PID_FILE="$RUN_DIR/server.pid"
WEB_PID_FILE="$RUN_DIR/web.pid"
SERVER_LOG="$RUN_DIR/server.log"
WEB_LOG="$RUN_DIR/web.log"

# Fixed, predictable ports by default (override with env vars). Deliberately
# NOT "pick whatever's free" - a silently-shifted port is exactly what made
# the plain `pnpm dev` flow confusing to debug earlier. server_start*.sh pass
# --strictPort to vite, so a taken port fails loudly here instead of quietly
# moving to a different one.
SERVER_PORT="${CORDIS_TUTORIAL_SERVER_PORT:-8788}"
WEB_PORT="${CORDIS_TUTORIAL_WEB_PORT:-5174}"

mkdir -p "$RUN_DIR"

pid_alive() {
  local pid="${1:-}"
  [[ -n "$pid" ]] && kill -0 "$pid" 2>/dev/null
}

read_pid_file() {
  local file="$1"
  if [[ -f "$file" ]]; then cat "$file"; fi
}

# Every pid currently holding the LISTEN socket for a port. Informational
# only (used by server_status.sh) - NEVER used to decide what to kill. A
# process on the port might not be ours (e.g. an unrelated project that
# happens to be using the same default port), and killing indiscriminately
# by port silently took down a different project's dev server the one time
# this script did that. Only pids this script itself recorded get killed.
port_pids() {
  local port="$1"
  lsof -ti "tcp:$port" -sTCP:LISTEN 2>/dev/null || true
}

# start_group.sh starts every job with `set -m`, so each backgrounded
# command becomes the leader of its own new process group and $! IS that
# group's id. server_stop.sh signals -$pid (the whole group) rather than
# just that one pid, because `pnpm run dev` -> tsx watch -> node is a chain
# of forked children that a single-pid SIGTERM does not reliably reach.
#
# SIGTERM every group, poll for real exit, escalate to SIGKILL only if
# needed, verify, and never touch a pid this script didn't itself start.
kill_group_with_guarantee() {
  local pids=("$@")
  [[ ${#pids[@]} -eq 0 ]] && return 0

  local pid
  for pid in "${pids[@]}"; do
    pid_alive "$pid" && kill -TERM -- "-$pid" 2>/dev/null || true
  done

  local waited=0
  while (( waited < 5000 )); do
    local still_alive=0
    for pid in "${pids[@]}"; do
      pid_alive "$pid" && still_alive=1
    done
    [[ "$still_alive" -eq 0 ]] && return 0
    sleep 0.25
    waited=$(( waited + 250 ))
  done

  for pid in "${pids[@]}"; do
    pid_alive "$pid" && kill -KILL -- "-$pid" 2>/dev/null || true
  done
  sleep 0.5

  for pid in "${pids[@]}"; do
    if pid_alive "$pid"; then
      echo "warning: process group $pid still alive after SIGKILL" >&2
    fi
  done
}

wait_for_health() {
  local url="$1" tries="${2:-40}"
  local i=0
  while (( i < tries )); do
    curl -fsS "$url" >/dev/null 2>&1 && return 0
    sleep 0.25
    i=$(( i + 1 ))
  done
  return 1
}
