#!/bin/bash
# tests/enforce-subagent-model-test.sh — 서브에이전트 모델 티어링 훅 시나리오 테스트
# CI(ci-gate quality)·로컬 동일 실행: bash tests/enforce-subagent-model-test.sh
set -u

H="$(cd "$(dirname "$0")/.." && pwd)/plugins/harness-guard/scripts/enforce-subagent-model.py"
PASS=0; FAIL=0

# 이 테스트는 훅을 수십 회 호출한다 — 실 감사 로그(~/.claude/hooks/subagent-model.log)에
# 쓰면 사용자의 진짜 감사 이력을 오염시킨다(2026-07 실제 사고: 레이스 재현 테스트가 그 로그를
# 덮어써 당일 이력이 유실됨). HARNESS_SUBAGENT_MODEL_LOG로 임시 파일에 격리한다.
export HARNESS_SUBAGENT_MODEL_LOG; HARNESS_SUBAGENT_MODEL_LOG="$(mktemp -t enforce-subagent-model-test-log)"
trap 'rm -f "$HARNESS_SUBAGENT_MODEL_LOG"' EXIT

# subagent_type·(선택)model·(선택)tool_name 으로 hook 입력 JSON 생성 → hook 실행
run() { # subagent_type [model] [tool_name=Agent]
  python3 -c "import json,sys
ti={'subagent_type':sys.argv[1]}
if sys.argv[2]: ti['model']=sys.argv[2]
print(json.dumps({'tool_name':sys.argv[3],'tool_input':ti}))" "$1" "${2:-}" "${3:-Agent}" | python3 "$H"
}

# updatedInput.model 추출 (미터치/no-op이면 빈 문자열)
forced_model() {
  python3 -c "import sys,json
try: print(json.load(sys.stdin)['hookSpecificOutput']['updatedInput']['model'])
except Exception: print('')"
}

check() { # desc, expected_model, subagent_type, [passed_model], [tool]
  local desc="$1" want="$2" got
  got=$(run "$3" "${4:-}" "${5:-Agent}" | forced_model)
  if [ "$got" = "$want" ]; then echo "PASS: $desc"; PASS=$((PASS+1))
  else echo "FAIL: $desc — expected '$want' got '$got'"; FAIL=$((FAIL+1)); fi
}

# TIER 타입 → 강제 다운그레이드
check "Explore → haiku 강제"                 haiku   Explore
check "general-purpose → sonnet 강제"        sonnet  general-purpose
check "claude(캐치올) → sonnet 강제"          sonnet  claude
# DEFAULT 타입(opus 전용 특권) → 미지정 시 opus 기본값 채움
# 실제 subagent_type은 harness-guard: 네임스페이스 포함(구버전은 bare "verifier"로 오기돼 있었음 — 정정)
check "verifier 미지정 → opus 기본값 채움"           opus  harness-guard:verifier
check "security-reviewer 미지정 → opus 기본값 채움"  opus  harness-guard:security-reviewer
# TIER·DEFAULT 모두 없는 타입 → 미터치(메인 모델 상속)
check "Plan 미터치"                           ""      Plan
check "harness-manager 미터치"                ""      harness-manager
check "미지정(unknown) 타입 미터치"           ""      unknown-type

# 하드포스: 넘긴 model 무시하고 타입 티어 강제 (LLM이 opus로 못 올림)
check "general-purpose+opus → sonnet 하드포스" sonnet  general-purpose  opus
check "Explore+opus → haiku 하드포스"          haiku   Explore          opus
check "general-purpose+haiku → sonnet(하향 방지)" sonnet general-purpose haiku
# passed==forced → no-op(불필요 재작성 없음, 빈 출력)
check "general-purpose+sonnet no-op"          ""      general-purpose  sonnet
check "Explore+haiku no-op"                   ""      Explore          haiku

# DEFAULT: 명시값 있으면 그대로 존중(하드포스와 반대 — 의식적 다운그레이드/변경 허용)
check "verifier+sonnet 명시 → 존중(오버라이드 안 함)"  ""  harness-guard:verifier  sonnet
check "verifier+haiku 명시 → 존중(다운그레이드 허용)"  ""  harness-guard:verifier  haiku
check "verifier+opus 명시(기본값과 동일) → 존중"       ""  harness-guard:verifier  opus
check "security-reviewer+sonnet 명시 → 존중"          ""  harness-guard:security-reviewer  sonnet

# 비Agent 도구 → 미터치 (TIER·DEFAULT 타입 둘 다 확인)
check "비Agent(Bash) 미터치 — TIER 타입"      ""      Explore                 ""  Bash
check "비Agent(Bash) 미터치 — DEFAULT 타입"   ""      harness-guard:verifier  ""  Bash

# 엣지: model 키는 있지만 빈 문자열("") — falsy로 취급돼 DEFAULT 채움이 적용돼야 함
edge_case() { # desc, want, python_dict_literal
  local desc="$1" want="$2" got
  got=$(python3 -c "import json; print(json.dumps({'tool_name':'Agent','tool_input':$3}))" | python3 "$H" | forced_model)
  if [ "$got" = "$want" ]; then echo "PASS: $desc"; PASS=$((PASS+1))
  else echo "FAIL: $desc — expected '$want' got '$got'"; FAIL=$((FAIL+1)); fi
}
edge_case "model=빈문자열(키 존재) → DEFAULT 채움(falsy 취급)" \
  opus "{'subagent_type':'harness-guard:verifier','model':''}"
edge_case "model=null(JSON null) → DEFAULT 채움(falsy 취급)" \
  opus "{'subagent_type':'harness-guard:verifier','model':None}"

# 엣지: 잘못된 JSON 입력 — 크래시 없이 안전 무시(비용 fail-open), 출력 없음
{
  desc="잘못된 JSON 입력 → 크래시 없이 안전 무시"
  out=$(printf 'not json at all' | python3 "$H" 2>&1); rc=$?
  if [ "$rc" -eq 0 ] && [ -z "$out" ]; then echo "PASS: $desc"; PASS=$((PASS+1))
  else echo "FAIL: $desc — rc=$rc out='$out'"; FAIL=$((FAIL+1)); fi
}

# 엣지: JSON은 유효하지만 형태가 예상과 다름 — 2026-07 발견(uncaught 예외가 fail-open 계약을 깸)
shape_error_case() { # desc, python_json_literal
  local desc="$1" out rc
  out=$(printf '%s' "$2" | python3 "$H" 2>&1); rc=$?
  if [ "$rc" -eq 0 ] && [ -z "$out" ]; then echo "PASS: $desc"; PASS=$((PASS+1))
  else echo "FAIL: $desc — rc=$rc out='$out'"; FAIL=$((FAIL+1)); fi
}
shape_error_case "최상위 JSON이 object가 아님(배열) → 크래시 없이 안전 무시" \
  '[1,2,3]'
shape_error_case "tool_input이 dict가 아님(문자열) → 크래시 없이 안전 무시" \
  '{"tool_name":"Agent","tool_input":"not a dict"}'
shape_error_case "subagent_type이 unhashable(리스트) → 크래시 없이 안전 무시" \
  '{"tool_name":"Agent","tool_input":{"subagent_type":["nested","list"]}}'

# 위 3건이 감사 로그에 shape-error로 기록되는지(격리된 임시 로그라 안전하게 검사 가능)
{
  desc="shape-error 3건이 격리 로그에 기록됨"
  got=$(grep -c "shape-error" "$HARNESS_SUBAGENT_MODEL_LOG" 2>/dev/null || echo 0)
  if [ "$got" -eq 3 ]; then echo "PASS: $desc"; PASS=$((PASS+1))
  else echo "FAIL: $desc — expected 3, got $got"; FAIL=$((FAIL+1)); fi
}

# 보안: model에 개행 포함 값을 넣어도 감사 로그에 위조 라인이 안 생겨야 함(repr 이스케이프 확인)
{
  desc="model 개행 포함 → 로그 위조 안 됨(repr 이스케이프, 실제 라인 1개만 추가)"
  before=$(wc -l <"$HARNESS_SUBAGENT_MODEL_LOG" 2>/dev/null || echo 0)
  python3 -c "import json; print(json.dumps({'tool_name':'Agent','tool_input':{'subagent_type':'harness-guard:verifier','model':'haiku\nFORGED session=evil cwd=/pwn force type=admin'}}))" | python3 "$H" >/dev/null
  after=$(wc -l <"$HARNESS_SUBAGENT_MODEL_LOG" 2>/dev/null || echo 0)
  added=$((after - before))
  if [ "$added" -eq 1 ]; then echo "PASS: $desc"; PASS=$((PASS+1))
  else echo "FAIL: $desc — expected 1줄 추가, got ${added}줄(개행이 새어나가 위조 라인 생성 의심)"; FAIL=$((FAIL+1)); fi
}

echo ""
echo "결과: PASS=$PASS FAIL=$FAIL"
[ "$FAIL" -eq 0 ]
