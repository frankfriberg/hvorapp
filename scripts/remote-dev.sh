#!/usr/bin/env bash
# Runs the web app and Metro so a development build on a phone reaches both
# over Tailscale, wherever the phone is.
#
#   scripts/remote-dev.sh start | stop | status | logs
#
# The web app serves the API with dev sign-in on :9100; Metro serves the
# bundle on :8081 with the API URL baked in. iOS refuses plain HTTP to a
# ts.net name, so `tailscale serve` puts each behind HTTPS on its own port
# (rc keeps 443). Logs and PIDs go in .remote-dev/.
set -euo pipefail
# Background jobs get their own process group, so stop can kill the whole tree.
set -m

root="$(cd "$(dirname "$0")/.." && pwd)"
state="$root/.remote-dev"
web_port=9100
metro_port=8081
web_https=9443
metro_https=8443

tailnet_host() {
  tailscale status --json 2>/dev/null |
    python3 -c "import json,sys;print(json.load(sys.stdin)['Self']['DNSName'].rstrip('.'))"
}

running() {
  [[ -f "$state/$1.pid" ]] && kill -0 "$(cat "$state/$1.pid")" 2>/dev/null
}

# Kills the process group, so npm's children (next, expo) go with it.
stop_one() {
  if running "$1"; then
    kill -- "-$(cat "$state/$1.pid")" 2>/dev/null || true
    echo "$1: stopped"
  fi
  rm -f "$state/$1.pid"
}

# Anything else holding the port, such as a Metro started by hand.
free_port() {
  local pids
  pids="$(lsof -tiTCP:"$1" -sTCP:LISTEN || true)"
  if [[ -n "$pids" ]]; then
    echo "port $1: stopping $pids"
    kill $pids
  fi
}

# HTTPS on the tailnet name, proxied to a local port.
serve() {
  tailscale serve --bg --https="$1" "http://127.0.0.1:$2" >/dev/null 2>&1
}

unserve() {
  tailscale serve --https="$1" off >/dev/null 2>&1 || true
}

# Until something answers behind the proxy, which says 502 meanwhile.
wait_for() {
  local code
  for _ in $(seq 1 60); do
    code="$(curl -s -m2 -o /dev/null -w "%{http_code}" "$1" || true)"
    [[ "$code" != 000 && "$code" != 502 ]] && return 0
    sleep 1
  done
  echo "timed out waiting for $1" >&2
  return 1
}

start() {
  mkdir -p "$state"
  local host
  host="$(tailnet_host)"

  stop_one web
  stop_one metro
  free_port "$web_port"
  free_port "$metro_port"

  serve "$web_https" "$web_port"
  serve "$metro_https" "$metro_port"

  cd "$root"
  HVOR_DEV_AUTH=1 nohup npm run dev >"$state/web.log" 2>&1 &
  echo $! >"$state/web.pid"

  cd "$root/mobile"
  EXPO_PACKAGER_PROXY_URL="https://$host:$metro_https" \
    EXPO_PUBLIC_API_URL="https://$host:$web_https" \
    EXPO_PUBLIC_DEV_AUTH=1 \
    nohup npx expo start --dev-client --port "$metro_port" --clear \
    >"$state/metro.log" 2>&1 &
  echo $! >"$state/metro.pid"

  wait_for "https://$host:$web_https/api/me"
  wait_for "https://$host:$metro_https/status"
  status
}

status() {
  local host
  host="$(tailnet_host)"
  for name in web metro; do
    if running "$name"; then echo "$name: running ($(cat "$state/$name.pid"))"; else echo "$name: stopped"; fi
  done
  echo "api:   https://$host:$web_https"
  echo "metro: https://$host:$metro_https"
  # The dev launcher only finds Metro on the local network; this opens it directly.
  echo "open:  hvor://expo-development-client/?url=https%3A%2F%2F$host%3A$metro_https"
}

case "${1:-}" in
  start) start ;;
  stop) stop_one web; stop_one metro; unserve "$web_https"; unserve "$metro_https" ;;
  status) status ;;
  logs) tail -n 40 "$state/web.log" "$state/metro.log" ;;
  *) echo "usage: $0 start|stop|status|logs" >&2; exit 1 ;;
esac
