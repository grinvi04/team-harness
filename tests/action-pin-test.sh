#!/usr/bin/env bash
set -u
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
bad=""
while IFS= read -r line; do
  ref=${line#*@}; ref=${ref%% *}
  [[ "$ref" =~ ^[0-9a-f]{40}$ ]] || bad="${bad}${bad:+$'\n'}$line"
done < <(rg -n '^\s*(#\s*)?-?\s*uses:\s*[^./][^@ ]+@' "$ROOT/.github" "$ROOT/templates/ci" --glob '*.yml' --glob '*.yaml' || true)
if [ -n "$bad" ]; then
  echo "FAIL: 가변 또는 비-SHA Action 참조"
  echo "$bad"
  exit 1
fi
echo "PASS: 외부 Action 참조 full SHA 고정"
