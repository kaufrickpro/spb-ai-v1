#!/usr/bin/env bash
set -euo pipefail

freshclam || echo "freshclam update failed; continuing with bundled signatures if present" >&2

clamd --config-file=/etc/clamav/clamd.conf &
clamd_pid="$!"

for _ in $(seq 1 60); do
  if /usr/bin/clamdscan --config-file=/etc/clamav/clamd.conf --ping >/dev/null 2>&1; then
    break
  fi
  sleep 1
done

node /app/dist/main.js &
node_pid="$!"

trap 'kill "$node_pid" "$clamd_pid" 2>/dev/null || true' TERM INT
wait "$node_pid"
