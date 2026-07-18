#!/usr/bin/env bash
set -u
shopt -s extglob
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
bad=""
pattern="(^|[,{[:space:]-])[\"']?uses[\"']?[[:space:]]*:"
check_line() {
  local line="$1" content value ref
  content=${line#*:}; content=${content#*:}
  value=$(printf '%s\n' "$content" | sed -E "s/.*[\"']?uses[\"']?[[:space:]]*:[[:space:]]*//")
  value=${value##+([[:space:]])}; value=${value%% #*}
  value=${value%%,+([[:space:]])}; value=${value%%\}+([[:space:]])}
  case "$value" in \"*\") value=${value#\"}; value=${value%\"};; \'*\') value=${value#\'}; value=${value%\'};; esac
  case "$value" in ./*) return 0;; esac
  case "$value" in docker://*) [[ "$value" =~ @sha256:[0-9a-f]{64}$ ]] || bad="${bad}${bad:+$'\n'}$line"; return 0;; esac
  ref=${value#*@}
  [[ "$value" == *@* && "$ref" =~ ^[0-9a-f]{40}$ ]] || bad="${bad}${bad:+$'\n'}$line"
}
while IFS= read -r line; do
  check_line "$line"
done < <(rg -n "$pattern" "$ROOT/.github" "$ROOT/templates/ci" --glob '*.yml' --glob '*.yaml' || true)
# parser self-contract: quoted external SHA passes, quoted movable tag fails, quoted local action is skipped.
before="$bad"; check_line 'x:1:  - uses: "actions/checkout@93cb6efe18208431cddfb8368fd83d5badbf9bfd"'; [ "$bad" = "$before" ] || { echo "FAIL: quoted SHA value 오탐"; exit 1; }
check_line 'x:2:  - "uses": actions/checkout@v5'; [ "$bad" != "$before" ] || { echo "FAIL: quoted uses key 미탐"; exit 1; }; bad="$before"
check_line 'x:3:  - uses: "./local-action"'; [ "$bad" = "$before" ] || { echo "FAIL: quoted local action 오탐"; exit 1; }
check_line 'x:4:  - {uses: actions/checkout@v5}'; [ "$bad" != "$before" ] || { echo "FAIL: flow mapping uses 미탐"; exit 1; }; bad="$before"
check_line 'x:5:  - uses: docker://alpine:3.8'; [ "$bad" != "$before" ] || { echo "FAIL: mutable docker image 미탐"; exit 1; }; bad="$before"
check_line 'x:6:  - uses: docker://alpine@sha256:0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef'; [ "$bad" = "$before" ] || { echo "FAIL: digest-pinned docker image 오탐"; exit 1; }
if [ -n "$bad" ]; then
  echo "FAIL: 가변 또는 비-SHA Action 참조"
  echo "$bad"
  exit 1
fi
echo "PASS: 외부 Action 참조 full SHA 고정"
