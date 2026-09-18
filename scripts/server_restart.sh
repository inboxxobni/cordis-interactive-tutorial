#!/usr/bin/env bash
# Stop, then start in daemon (background) mode.
set -eo pipefail
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

"$DIR/server_stop.sh"
"$DIR/server_start_daemon.sh"
