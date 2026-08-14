#!/bin/bash
set -e
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$DIR"

URL="http://127.0.0.1:5000/"

if ! curl -s -o /dev/null "$URL"; then
  source venv/bin/activate
  cd "$DIR/Backend"
  nohup python app.py > /tmp/portfolio-dashboard.log 2>&1 &
  cd "$DIR"

  for i in $(seq 1 30); do
    curl -s -o /dev/null "$URL" && break
    sleep 0.3
  done
fi

xdg-open "$URL" >/dev/null 2>&1 &
