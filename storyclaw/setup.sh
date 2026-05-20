#!/usr/bin/env bash
#
# StoryClaw one-command bring-up for the random HTML game generator.
#
# This follows the tunnel registration contract used by the dashboard
# agents: stable 12-char device id + api.clawln.app/devices/register.
# Unlike a pure static dashboard, this app needs a Node backend for
# /api/publish-custom-game, so the tunnel ingress points at this Node
# process. The Node server also serves ~/.claw/hub/public at /static/.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
CLAW="${CLAW_HOME:-$HOME/.claw}"
PUBLIC="${CLAW_HUB_PUBLIC:-$CLAW/hub/public}"
CONFIG="$CLAW/config"
PORT_FILE="$CLAW/hub-port"
PID_FILE="$CLAW/game-generator.pid"
LOG_FILE="$CLAW/game-generator.log"
TUNNEL_API="${CLAW_TUNNEL_API:-https://api.clawln.app}"

log() { printf '\033[36m[game-setup]\033[0m %s\n' "$*"; }

pick_device_id() {
  local id_file_sys="/etc/claw/device-id"
  local id_file="$CLAW/device-id"
  local serial=""

  if [ -n "${CLAW_DEVICE_SERIAL:-}" ]; then
    serial="$CLAW_DEVICE_SERIAL"
  elif [ -s "$id_file_sys" ]; then
    serial="$(cat "$id_file_sys")"
  elif [ -s "$id_file" ]; then
    serial="$(cat "$id_file")"
  else
    serial="$(uuidgen 2>/dev/null || cat /proc/sys/kernel/random/uuid 2>/dev/null || true)"
    serial="$(printf '%s' "$serial" | tr -dc 'A-Za-z0-9' | cut -c1-12)"
    [ -n "$serial" ] || { echo "ERROR: could not generate a device id; set CLAW_DEVICE_SERIAL" >&2; exit 1; }
    mkdir -p "$(dirname "$id_file")"
    printf '%s' "$serial" > "$id_file"
    log "generated stable device id at $id_file"
  fi

  serial="$(printf '%s' "$serial" | tr -dc 'A-Za-z0-9' | cut -c1-12 | tr 'a-z' 'A-Z')"
  if ! printf '%s' "$serial" | grep -qE '^[A-Z0-9]{12}$'; then
    echo "ERROR: device id '$serial' is not 12 alphanumerics. Set CLAW_DEVICE_SERIAL to a 12-char id." >&2
    exit 1
  fi

  printf '%s' "$serial"
}

port_is_open() {
  python3 - "$1" <<'PY'
import socket, sys
port = int(sys.argv[1])
s = socket.socket()
s.settimeout(0.25)
sys.exit(0 if s.connect_ex(("127.0.0.1", port)) == 0 else 1)
PY
}

is_game_server() {
  curl -fsS "http://127.0.0.1:$1/api/health" 2>/dev/null | grep -q "random-html-game-generator"
}

pick_port() {
  if [ -n "${CLAW_GAME_PORT:-}" ]; then
    printf '%s' "$CLAW_GAME_PORT"
    return
  fi

  if [ -n "${CLAW_HUB_PORT:-}" ]; then
    printf '%s' "$CLAW_HUB_PORT"
    return
  fi

  if [ -s "$PORT_FILE" ]; then
    local persisted
    persisted="$(cat "$PORT_FILE")"
    if is_game_server "$persisted" || ! port_is_open "$persisted"; then
      printf '%s' "$persisted"
      return
    fi
  fi

  for port in 7330 7430 8930 9330 7331 7431; do
    if ! port_is_open "$port"; then
      printf '%s' "$port"
      return
    fi
  done

  printf '7330'
}

start_game_server() {
  local port="$1"
  local public_url="$2"

  if is_game_server "$port"; then
    log "game generator already running on :$port"
    return
  fi

  if port_is_open "$port"; then
    echo "ERROR: port $port is already in use by another process. Set CLAW_GAME_PORT to a free port." >&2
    exit 1
  fi

  log "starting game generator on :$port"
  (
    cd "$APP_DIR"
    export PORT="$port"
    export HOST="${HOST:-127.0.0.1}"
    export CLAW_HUB_PUBLIC_DIR="$PUBLIC"
    export CLAW_HUB_PUBLIC_ORIGIN="$public_url"
    if command -v npm >/dev/null 2>&1; then
      nohup npm start > "$LOG_FILE" 2>&1 &
    else
      nohup node server.js > "$LOG_FILE" 2>&1 &
    fi
    echo $! > "$PID_FILE"
    disown
  )

  sleep 2
  is_game_server "$port" || {
    echo "ERROR: game generator did not become healthy. See $LOG_FILE" >&2
    exit 1
  }
}

register_tunnel() {
  local serial="$1"
  local port="$2"

  mkdir -p "$CONFIG"
  if curl -fsS -X POST "$TUNNEL_API/devices/register" \
      -H "Content-Type: application/json" \
      -d "{\"serial\":\"$serial\",\"port\":$port}" \
      -o "$CONFIG/tunnel.json" 2>/dev/null; then
    log "tunnel registered"
  elif [ -s "$CONFIG/tunnel.json" ]; then
    log "WARN register call failed; reusing existing $CONFIG/tunnel.json"
  else
    echo "ERROR: tunnel registration failed and no cached tunnel.json exists" >&2
    exit 1
  fi
}

json_value() {
  python3 - "$1" "$2" <<'PY'
import json, sys
path, key = sys.argv[1:3]
try:
    print(json.load(open(path)).get(key, ""))
except Exception:
    print("")
PY
}

main() {
  mkdir -p "$CLAW" "$PUBLIC" "$CONFIG"

  local serial port public_url token
  serial="$(pick_device_id)"
  port="$(pick_port)"
  printf '%s' "$port" > "$PORT_FILE"

  log "device id: $serial"
  log "tunnel ingress port: $port"

  register_tunnel "$serial" "$port"
  public_url="$(json_value "$CONFIG/tunnel.json" public_url)"
  token="$(json_value "$CONFIG/tunnel.json" tunnel_token)"
  [ -n "$public_url" ] || public_url="https://device-${serial}.clawln.app"

  start_game_server "$port" "$public_url"

  if pgrep -f "cloudflared tunnel run" >/dev/null 2>&1; then
    log "cloudflared already running"
  elif command -v cloudflared >/dev/null 2>&1 && [ -n "$token" ]; then
    log "starting cloudflared"
    nohup cloudflared tunnel run --token "$token" > "$CLAW/tunnel.log" 2>&1 &
    disown
  else
    log "WARN cloudflared missing or no token; public URL may stay offline"
  fi

  cat <<EOF

-------- game generator ready --------
 URL        : ${public_url}/
 publishes  : ${public_url}/static/games/<generated-id>/index.html
 local      : http://127.0.0.1:${port}/
 public dir : ${PUBLIC}
 log        : ${LOG_FILE}
 pid        : ${PID_FILE}
--------------------------------------
EOF
}

main "$@"
