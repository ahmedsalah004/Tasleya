#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${1:-http://127.0.0.1:8080}"

core_routes=(
  "/" "/games/" "/play/" "/how-to-play/" "/categories/" "/articles/" "/about/" "/contact/" "/privacy/" "/terms/" "/faq/" "/sitemap.xml" "/robots.txt"
)

check_status() {
  local route="$1"
  local expected="$2"
  local code
  code=$(curl -s -o /dev/null -w '%{http_code}' "$BASE_URL$route")
  if [[ "$code" == "$expected" ]]; then
    printf 'PASS %-55s %s\n' "$route" "$code"
  else
    printf 'FAIL %-55s got=%s expected=%s\n' "$route" "$code" "$expected"
  fi
}

echo "Base URL: $BASE_URL"
echo "=== Core route status checks ==="
for route in "${core_routes[@]}"; do
  check_status "$route" "200"
done

echo "=== Privacy-policy redirect checks ==="
for route in "/privacy-policy/" "/privacy-policy"; do
  code=$(curl -s -o /dev/null -w '%{http_code}' "$BASE_URL$route")
  target=$(curl -s -I "$BASE_URL$route" | awk 'tolower($1)=="location:"{print $2}' | tr -d '\r' | tail -n1)
  if [[ "$code" =~ ^30[1278]$ ]] && [[ "$target" == "/privacy/" || "$target" == "$BASE_URL/privacy/" || "$target" == "https://tasleya.online/privacy/" ]]; then
    printf 'PASS %-55s %s -> %s\n' "$route" "$code" "$target"
  else
    printf 'FAIL %-55s code=%s location=%s\n' "$route" "$code" "${target:-<none>}"
  fi
done

echo "=== 404 check ==="
check_status "/random-fake-page-for-adsense-test/" "404"
