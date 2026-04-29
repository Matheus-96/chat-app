#!/usr/bin/env bash
set -e
# Start dev server in background
npm run dev -- --host 0.0.0.0 &
SERVER_PID=$!
# Wait for server to start (simple wait)
sleep 8
# Test endpoint
if curl -f http://localhost:5173/room/test; then
  echo "Server responded OK"
else
  echo "Server test failed"
  exit 1
fi
# Kill server
kill $SERVER_PID || true
