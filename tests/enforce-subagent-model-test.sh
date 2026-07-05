#!/bin/bash
# tests/enforce-subagent-model-test.sh — 서브에이전트 모델 티어링 훅 시나리오 테스트
# CI(ci-gate quality)·로컬 동일 실행: bash tests/enforce-subagent-model-test.sh
set -u

H="$(cd "$(dirname "$0")/.." && pwd)/plugins/harness-guard/scripts/enforce-subagent-model.py"
PASS=0; FAIL=0

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

echo ""
echo "결과: PASS=$PASS FAIL=$FAIL"
[ "$FAIL" -eq 0 ]
