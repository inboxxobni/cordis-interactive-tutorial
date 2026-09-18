#!/usr/bin/env bash
# Reports both the pidfile's view and the port's actual view. A process
# actually bound to the port can have a different pid than the one we
# recorded (pnpm -> tsx watch -> node is a chain of forked children) - that
# alone is normal, not a problem, as long as it's in the SAME process group
# we started. Only a genuinely different group is flagged.
set -eo pipefail
source "$(dirname "${BASH_SOURCE[0]}")/lib.sh"

pgid_of() {
  ps -o pgid= -p "$1" 2>/dev/null | tr -d ' '
}

report() {
  local label="$1" pidfile="$2" port="$3"
  local pid; pid="$(read_pid_file "$pidfile")"
  local port_pid; port_pid="$(port_pids "$port" | head -1)"

  if pid_alive "$pid"; then
    if [[ -n "$port_pid" ]]; then
      local our_group port_group
      our_group="$(pgid_of "$pid")"
      port_group="$(pgid_of "$port_pid")"
      if [[ -n "$our_group" && "$our_group" == "$port_group" ]]; then
        echo "$label: RUNNING  pid $pid  http://localhost:$port"
      else
        echo "$label: tracked pid $pid is alive, but port $port is held by an UNRELATED process (pid $port_pid) - investigate"
      fi
    else
      echo "$label: tracked pid $pid is alive, but nothing is listening on $port yet (still starting up?)"
    fi
  elif [[ -n "$port_pid" ]]; then
    echo "$label: NOT tracked as running, but something IS listening on $port (pid $port_pid) - stale pidfile, or a process started outside these scripts"
  else
    echo "$label: stopped"
  fi
}

report "server" "$SERVER_PID_FILE" "$SERVER_PORT"
report "web   " "$WEB_PID_FILE" "$WEB_PORT"
