#!/usr/bin/env bash
set -euo pipefail

PORT="${PORT:-3100}"
LOG="${TMPDIR:-/tmp}/sealed-ledger-smoke.log"
HEALTH="${TMPDIR:-/tmp}/sealed-ledger-health.json"
STARTED_SERVER=0

cleanup() {
  if [ "$STARTED_SERVER" -eq 1 ] && [ -n "${PID:-}" ]; then
    kill "$PID" 2>/dev/null || true
  fi
  if [ "$STARTED_SERVER" -eq 1 ] && command -v lsof >/dev/null 2>&1; then
    lsof -ti:"$PORT" -sTCP:LISTEN 2>/dev/null | xargs kill 2>/dev/null || true
  fi
}
trap cleanup EXIT

# If the app is already running locally, test it directly. Next.js refuses to
# start a second dev server for the same project directory, so this is also the
# path used while `npm run dev` is open in another terminal.
if [ -n "${SMOKE_URL:-}" ]; then
  TARGET_URL="$SMOKE_URL"
elif curl -sf --max-time 2 "http://localhost:3000/api/health" >/dev/null 2>&1; then
  TARGET_URL="http://localhost:3000"
  echo "Using the already-running server at ${TARGET_URL}"
else
  if command -v lsof >/dev/null 2>&1 && lsof -ti:"$PORT" -sTCP:LISTEN >/dev/null 2>&1; then
    echo "Port $PORT is already in use. Set PORT to a free port and retry." >&2
    exit 1
  fi

  TARGET_URL="http://localhost:${PORT}"
  npm run dev -- --port "$PORT" >"$LOG" 2>&1 &
  PID=$!
  STARTED_SERVER=1
  echo "Starting a dev server at ${TARGET_URL} (log: ${LOG})"
fi

for _ in $(seq 1 45); do
  if curl -sf --max-time 2 "${TARGET_URL}/api/health" -o "$HEALTH" 2>/dev/null; then
    break
  fi
  sleep 1
done

if [ ! -s "$HEALTH" ]; then
  echo "Health check did not respond at ${TARGET_URL}." >&2
  if [ -f "$LOG" ]; then
    tail -30 "$LOG" >&2 || true
  fi
  exit 1
fi

node -e '
const fs = require("fs");
const health = JSON.parse(fs.readFileSync(process.argv[1], "utf8"));
if (!health.model) {
  console.error("Missing model in the health response");
  process.exit(1);
}
if (typeof health.configured !== "boolean") {
  console.error("Missing configured flag in the health response");
  process.exit(1);
}
console.log(JSON.stringify(health, null, 2));
if (!health.configured) {
  console.log("\nNote: NEARAI_CLOUD_API_KEY is not set; the UI loads but audits cannot run.");
}
' "$HEALTH"

echo "Smoke test passed against ${TARGET_URL}."
