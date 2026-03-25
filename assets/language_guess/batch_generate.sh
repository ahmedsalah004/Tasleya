#!/bin/zsh
set -u

SCRIPT_DIR="${0:A:h}"
PYTHON_BIN="$SCRIPT_DIR/.venv/bin/python"
MAIN_PY="$SCRIPT_DIR/main.py"
REQUESTS_FILE="${1:-$SCRIPT_DIR/languages.txt}"
LOG_DIR="$SCRIPT_DIR/logs"

mkdir -p "$LOG_DIR"

if [[ ! -x "$PYTHON_BIN" ]]; then
  echo "Missing virtualenv Python at $PYTHON_BIN"
  exit 1
fi

if [[ ! -f "$MAIN_PY" ]]; then
  echo "Missing main.py at $MAIN_PY"
  exit 1
fi

if [[ ! -f "$REQUESTS_FILE" ]]; then
  echo "Missing requests file at $REQUESTS_FILE"
  exit 1
fi

while IFS= read -r language || [[ -n "$language" ]]; do
  [[ -z "$language" ]] && continue
  safe_name="$(echo "$language" | tr '[:upper:]' '[:lower:]' | sed -E 's/[^a-z0-9]+/_/g; s/^_+//; s/_+$//')"
  echo "=== $language ==="
  "$PYTHON_BIN" "$MAIN_PY" "$language" 2>&1 | tee "$LOG_DIR/${safe_name}.log"
done < "$REQUESTS_FILE"
