#!/bin/bash
# tests/plugin-wiring-test.sh — harness-guard 플러그인 "배선" 반증-스모크.
#
# 기존 guard-test·guard-matrix·guard-tokenizer는 guard.sh에 JSON을 직접 파이프해 *내부 로직*만 본다.
# 그래서 hooks.json의 Bash matcher나 ${CLAUDE_PLUGIN_ROOT} 경로가 드리프트로 깨져 가드가 *영영
# 미발동*해도 그 240+ 테스트는 전부 GREEN이다 — 배선은 검증 사각지대다.
# 이 스모크는 hooks.json을 진실원본으로 삼아 그 사각지대를 닫는다:
#   섹션 A(계층1 guard.sh): hooks.json→guard 경로 해석이 실존하는지 + 그 *해석된 경로*로 보호 브랜치
#                            커밋이 실제로 차단(exit 2)되는지.
# 반증: hooks.json의 guard 경로를 존재하지 않는 값으로 바꾸면 이 스모크가 FAIL한다(현 배선에선 PASS).
# 로컬·CI 동일: bash tests/plugin-wiring-test.sh
set -u
ROOT="$(cd "$(dirname "$0")/.." && pwd)"; cd "$ROOT"
PLUGIN_ROOT="$ROOT/plugins/harness-guard"
HOOKS_JSON="$PLUGIN_ROOT/hooks/hooks.json"
PASS=0; FAIL=0

# ── 섹션 A: 계층1 (Claude Code PreToolUse → guard.sh) 배선 ────────────────────
# AC-1(배선 실존)·AC-2(경로 해석)를 python3로 검증하고 해석된 guard 경로를 stdout으로 넘긴다.
# 플러그인 루트 = hooks/의 부모(= plugins/harness-guard)로, ${CLAUDE_PLUGIN_ROOT}를 이 값으로 치환한다.
GUARD_PATH=""
while IFS= read -r line; do
  case "$line" in
    PASS:*) echo "$line"; PASS=$((PASS+1)) ;;
    FAIL:*) echo "$line"; FAIL=$((FAIL+1)) ;;
    GUARD_PATH=*) GUARD_PATH="${line#GUARD_PATH=}" ;;
  esac
done < <(python3 - "$HOOKS_JSON" "$PLUGIN_ROOT" <<'PY'
import json, os, shlex, sys
hooks_json, plugin_root = sys.argv[1], sys.argv[2]

def resolve(tok):
    return tok.replace("${CLAUDE_PLUGIN_ROOT}", plugin_root)

try:
    events = json.load(open(hooks_json)).get("hooks", {})
except Exception as e:
    print(f"FAIL: hooks.json 파싱 실패 ({e})")
    sys.exit(1)

# AC-1: PreToolUse에 matcher=="Bash"인 항목이 있고, 그 안에 guard.sh를 참조하는 command 훅이 있는가.
guard_cmd = None
for entry in events.get("PreToolUse", []):
    if entry.get("matcher") == "Bash":
        for h in entry.get("hooks", []):
            if h.get("type") == "command" and "guard.sh" in h.get("command", ""):
                guard_cmd = h["command"]
if guard_cmd:
    print("PASS: AC-1 PreToolUse Bash matcher에 guard.sh command 훅 배선 존재")
else:
    print("FAIL: AC-1 PreToolUse Bash matcher의 guard.sh command 훅 없음 (배선 부재/드리프트)")
    sys.exit(1)

# AC-2(핵심): guard 명령의 ${CLAUDE_PLUGIN_ROOT} 경로 토큰을 해석 → 실존·판독가능해야 한다.
guard_path = next((resolve(t) for t in shlex.split(guard_cmd) if "${CLAUDE_PLUGIN_ROOT}" in t), None)
if not guard_path:
    print("FAIL: AC-2 guard 명령에서 ${CLAUDE_PLUGIN_ROOT} 경로 토큰을 못 찾음")
    sys.exit(1)
if os.path.isfile(guard_path) and os.access(guard_path, os.R_OK):
    print("PASS: AC-2 guard.sh 해석 경로 실존·판독가능")
    print(f"GUARD_PATH={guard_path}")
else:
    print(f"FAIL: AC-2 guard.sh 해석 경로 부재/판독불가 ({guard_path})")
    sys.exit(1)

# AC-2 확장: hooks.json의 모든 type:command 훅 경로가 실존해야 한다(Agent·UserPromptSubmit 배선도 포함).
missing = []
for ev, entries in events.items():
    for entry in entries:
        for h in entry.get("hooks", []):
            if h.get("type") == "command":
                for t in shlex.split(h.get("command", "")):
                    if "${CLAUDE_PLUGIN_ROOT}" in t and not os.path.isfile(resolve(t)):
                        missing.append(f"{ev}:{resolve(t)}")
if missing:
    print("FAIL: AC-2 확장 — 부재 command 훅 경로: " + "; ".join(missing))
else:
    print("PASS: AC-2 확장 — 모든 command 훅 경로 실존")
PY
)

# AC-3(반증·실발동): AC-2에서 *해석된* guard 경로로 보호 브랜치 커밋이 실제로 차단되는가.
# guard-test.sh와 동일한 임시 repo 패턴 — 하드코딩 경로가 아니라 hooks.json 해석 경로를 쓰는 것이 핵심.
if [ -n "$GUARD_PATH" ]; then
  DEV=$(mktemp -d); trap 'rm -rf "$DEV"' EXIT
  git -C "$DEV" init -q
  git -C "$DEV" -c user.email=t@t -c user.name=t commit -q --allow-empty -m init
  git -C "$DEV" checkout -q -b develop
  json='{"tool_name":"Bash","tool_input":{"command":"git commit -m x"}}'
  out=$(cd "$DEV" && printf '%s' "$json" | bash "$GUARD_PATH" 2>&1); rc=$?
  if [ "$rc" = 2 ]; then
    echo "PASS: AC-3 해석된 guard 경로가 보호 브랜치 커밋 차단(exit 2)"; PASS=$((PASS+1))
  else
    echo "FAIL: AC-3 차단 실패 — expected exit 2, got $rc${out:+ ($out)}"; FAIL=$((FAIL+1))
  fi
else
  echo "FAIL: AC-3 스킵 — GUARD_PATH 미해석(AC-1/2 실패)"; FAIL=$((FAIL+1))
fi

echo ""
echo "결과: PASS=$PASS FAIL=$FAIL"
[ "$FAIL" -eq 0 ]
