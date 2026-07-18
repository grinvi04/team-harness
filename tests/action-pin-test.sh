#!/usr/bin/env bash
set -u
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
bad=""
pattern="^\\s*(#\\s*)?-?\\s*[\"']?uses[\"']?\\s*:\\s*[^./][^@ ]+@"
printf '%s\n' '  - "uses": actions/checkout@v5' | rg -q "$pattern" || { echo "FAIL: quoted uses key 탐지 계약"; exit 1; }
while IFS= read -r line; do
  ref=${line#*@}; ref=${ref%% *}
  [[ "$ref" =~ ^[0-9a-f]{40}$ ]] || bad="${bad}${bad:+$'\n'}$line"
done < <(rg -n "$pattern" "$ROOT/.github" "$ROOT/templates/ci" --glob '*.yml' --glob '*.yaml' || true)
if [ -n "$bad" ]; then
  echo "FAIL: 가변 또는 비-SHA Action 참조"
  echo "$bad"
  exit 1
fi
echo "PASS: 외부 Action 참조 full SHA 고정"
