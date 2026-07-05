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
# 특권/미등록 타입 → 미터치(opus 유지, 빈 출력)
check "verifier 미터치"                       ""      verifier
check "security-reviewer 미터치"              ""      security-reviewer
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
# 비Agent 도구 → 미터치
check "비Agent(Bash) 미터치"                  ""      Explore          ""    Bash

echo ""
echo "결과: PASS=$PASS FAIL=$FAIL"
[ "$FAIL" -eq 0 ]
