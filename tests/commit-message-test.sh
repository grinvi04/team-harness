#!/usr/bin/env bash
# 커밋 메시지 정책: Conventional Commits 호환 + team-harness 한국어·가독성 규칙.
set -u

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
CHECK="$ROOT/scripts/check-commit-message.cjs"
PASS=0
FAIL=0
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
BASH_BIN="$(command -v bash)"

case_message() { # 설명, 기대 종료코드, 메시지
  local desc="$1" want="$2" message="$3" file="$TMP/message"
  printf '%s\n' "$message" > "$file"
  node "$CHECK" --file "$file" >/dev/null 2>&1
  local got=$?
  if [ "$got" = "$want" ]; then
    echo "PASS: $desc"
    PASS=$((PASS+1))
  else
    echo "FAIL: $desc — expected $want, got $got"
    FAIL=$((FAIL+1))
  fi
}

case_message "feat: 한국어 header+scope+이유" 0 $'feat(order): 주문 한도 검증 추가\n\n이유: 잘못된 주문의 결제를 방지'
case_message "fix: 선택 영향·검증 필드" 0 $'fix(auth): 만료 토큰 재사용 차단\n\n이유: 만료된 세션이 다시 인증되는 문제 수정\n영향: 로그인 API\n검증: 인증 회귀 테스트 통과'
case_message "docs: header만 허용" 0 'docs(guide): 설치 절차 설명 보완'
case_message "build: 범용 타입 허용" 0 'build(ci): 리눅스 빌드 캐시 설정 추가'
case_message "revert: 범용 타입 허용" 0 'revert(order): 주문 한도 변경 되돌림'
case_message "breaking ! 단독 허용" 0 $'feat(api)!: 응답 필드 이름 변경\n\n이유: 공개 API 명칭을 도메인 용어와 통일'
case_message "breaking footer 단독 허용" 0 $'feat(api): 응답 형식 변경\n\n이유: 중첩 응답 구조를 단순화\n\nBREAKING CHANGE: response.data가 response로 이동'
case_message "Git merge 메시지 허용" 0 "Merge branch 'feature/order' into develop"
case_message "Git octopus merge 메시지 허용" 0 "Merge branches 'feature/order', 'feature/auth' and 'feature/search' into develop"
case_message "Git pull merge 메시지 허용" 0 "Merge branch 'main' of https://github.com/acme/project"
case_message "Git SSH pull merge 메시지 허용" 0 "Merge branch 'main' of git@github.com:acme/project.git"
case_message "Git annotated tag merge 메시지 허용" 0 "Merge tag 'v1.0.0'"$'\n\nrelease 1.0.0'
case_message "GitHub merge 메시지 허용" 0 'Merge pull request #347 from grinvi04/feature/order'
case_message "Git revert 메시지 허용" 0 $'Revert "feat(order): 주문 기능 추가"\n\nThis reverts commit abcdef0123456789abcdef0123456789abcdef01.'

case_message "영어 요약 거부" 1 $'feat(order): add order limit\n\n이유: 주문 한도를 추가'
case_message "코드 타입 scope 누락 거부" 1 $'fix: 주문 오류 수정\n\n이유: 잘못된 상태 코드를 바로잡음'
case_message "필수 이유 누락 거부" 1 'refactor(order): 주문 검증기 분리'
case_message "header 뒤 빈 줄 누락 거부" 1 $'perf(query): 조회 쿼리 단순화\n이유: 중복 조인을 제거'
case_message "요약 마침표 거부" 1 'docs: 설치 설명 보완.'
case_message "50자 초과 요약 거부" 1 "docs: $(printf '가%.0s' {1..51})"
case_message "미등록 타입 거부" 1 'update(core): 설정 파일 갱신'
case_message "형식 없는 메시지 거부" 1 '주문 검증 추가'
case_message "Revert 접두사 스푸핑 거부" 1 'Revert "규칙 우회"'
case_message "Revert 단축 SHA 스푸핑 거부" 1 $'Revert "규칙 우회"\n\nThis reverts commit abcdef.'
case_message "Merge 접두사 뒤 임의 내용 거부" 1 "Merge branch 'feature/order' into develop and bypass"
case_message "Octopus merge 임의 접미사 거부" 1 "Merge branches 'feature/order' and 'feature/auth' into develop and bypass"
case_message "Git pull merge 임의 접미사 거부" 1 "Merge branch 'main' of https://github.com/acme/project and bypass"
case_message "Git tag merge 임의 접미사 거부" 1 "Merge tag 'v1.0.0' and bypass"
case_message "Merge 메시지 임의 본문 거부" 1 $'Merge branch '\''feature/order'\'' into develop\n\n규칙 우회'

if node - "$ROOT" <<'NODE'
const { readFileSync } = require('node:fs')
const root = process.argv[2]
for (const configPath of [`${root}/commitlint.config.cjs`, `${root}/templates/commitlint.config.cjs`]) {
  const config = require(configPath)
  const rule = config.plugins?.[0]?.rules?.['team-harness-message']
  if (typeof rule !== 'function' || config.rules?.['team-harness-message']?.[0] !== 2) process.exit(1)
  if (config.defaultIgnores !== false || !Array.isArray(config.ignores)) process.exit(1)
  const ignored = (message) => config.ignores.some((ignore) => ignore(message))
  if (!ignored("Merge branch 'feature/order' into develop")) process.exit(1)
  if (!ignored('Revert "feat(order): 주문 기능 추가"\n\nThis reverts commit abcdef0123456789abcdef0123456789abcdef01.')) process.exit(1)
  if (ignored('Revert "규칙 우회"') || ignored('v1.2.3')) process.exit(1)
  const [valid] = rule({ raw: 'docs: 설치 설명 보완' })
  if (!valid) process.exit(1)
}

for (const workflowPath of [`${root}/.github/workflows/commitlint.yml`, `${root}/templates/ci/commitlint.yml`]) {
  const workflow = readFileSync(workflowPath, 'utf8')
  if (!/- uses: wagoid\/commitlint-github-action@v6\n\s+with:\n\s+configFile: \.\/commitlint\.config\.cjs/m.test(workflow)) {
    process.exit(1)
  }
}
NODE
then
  echo "PASS: root/template commitlint action·ignore가 동일 custom validator 사용"
  PASS=$((PASS+1))
else
  echo "FAIL: commitlint action config 경로 또는 ignore 배선 누락"
  FAIL=$((FAIL+1))
fi

for hook in "$ROOT/.githooks/commit-msg" "$ROOT/templates/githooks/commit-msg"; do
  if [ -x "$hook" ] && bash -n "$hook" && grep -Fq 'check-commit-message.cjs' "$hook"; then
    echo "PASS: ${hook#"$ROOT/"} 실행 배선"
    PASS=$((PASS+1))
  else
    echo "FAIL: ${hook#"$ROOT/"} 실행 배선 누락"
    FAIL=$((FAIL+1))
  fi
  mkdir -p "$TMP/no-node-bin"
  if PATH="$TMP/no-node-bin" "$BASH_BIN" "$hook" "$TMP/message" 2>"$TMP/no-node.err" \
    && grep -Fq 'CI' "$TMP/no-node.err"; then
    echo "PASS: ${hook#"$ROOT/"} Node 없음 → 경고 후 CI 위임"
    PASS=$((PASS+1))
  else
    echo "FAIL: ${hook#"$ROOT/"} Node 없음 처리"
    FAIL=$((FAIL+1))
  fi
done

echo
echo "결과: PASS=$PASS FAIL=$FAIL"
[ "$FAIL" -eq 0 ]
