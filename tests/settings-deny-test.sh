#!/bin/bash
# tests/settings-deny-test.sh — templates/settings.json 의 .env-리더 deny 커버리지 검증 (#237)
# 로컬·CI 동일 실행: bash tests/settings-deny-test.sh
#
# 반증 원칙(원칙 6, 내 표준 "거부 메커니즘은 우회로 검증"): deny 규칙이 '있다'가 아니라
#   '실제로 attack 명령을 막나'를 확인한다. Claude Code 권한 매처(deny > ask > allow,
#   `*`=임의 문자열·공백 포함, 파이프 서브커맨드 독립 평가)를 **문서 명세대로 재현**해
#   (claude-code-guide로 semantics 확정) `cat .env`/`grep KEY .env`가 DENIED 되고 정상
#   `cat app.js`는 ALLOWED 유지되는지 뚫어본다. 재현 매처≠CC 실물이라 잔여 불확실성은 문서화된
#   best-effort 한계(변수전개·명령치환·grep -r·미-allow 리더)로 남는다.
set -u

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SETTINGS="$ROOT/templates/settings.json"
TMP="$(mktemp)"
trap 'rm -f "$TMP"' EXIT
PASS=0; FAIL=0

# ── CC 권한 매처 재현 + 시나리오 판정을 node로 (JSON 파싱·glob). "want|got|desc" 줄 출력. ──
node - "$SETTINGS" > "$TMP" <<'NODE'
const fs = require('fs')
const s = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'))
const allow = s.permissions.allow || []
const deny = s.permissions.deny || []

// Bash 스펙 → 정규식: `Bash(X)`의 X를 이스케이프하되 '*'만 '.*'로. 전체 앵커.
//   (CC 문서: '*'는 공백 포함 임의 문자열. 후행 ' *' 워드바운더리 뉘앙스는 본 케이스에 무관.)
function toRe(spec) {
  const m = /^Bash\((.*)\)$/.exec(spec)
  if (!m) return null
  const re = m[1].replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*')
  return new RegExp('^' + re + '$')
}
const denyRes = deny.map(toRe).filter(Boolean)
const allowRes = allow.map(toRe).filter(Boolean)
const SEP = /\s*(?:&&|\|\||;|\|&|\||&|\n)\s*/  // CC 인식 구분자 — 서브커맨드 독립 평가
function verdict(cmd) {
  const subs = cmd.split(SEP).map(x => x.trim()).filter(Boolean)
  if (subs.some(sc => denyRes.some(r => r.test(sc)))) return 'DENY'   // deny > allow
  if (subs.every(sc => allowRes.some(r => r.test(sc)))) return 'ALLOW'
  return 'ASK'
}

const out = []
out.push(['no', allow.includes('Bash(gh api *)') ? 'yes' : 'no', '구조: 광범위 gh api 자동허용 제거'])
// ── 구조 잠금(#237): 실제 allow에 살아있는 리더(cat·grep)에 .env deny 존재 ──
out.push(['yes', deny.includes('Bash(cat *.env*)') ? 'yes' : 'no', '구조: deny에 Bash(cat *.env*)'])
out.push(['yes', deny.includes('Bash(grep *.env*)') ? 'yes' : 'no', '구조: deny에 Bash(grep *.env*)'])
// ── 반증: allow된 리더의 .env 열람 우회가 실제로 차단되나 ──
out.push(['DENY',  verdict('cat .env'),                    '우회: cat .env 차단'])
out.push(['DENY',  verdict('cat ./.env'),                  '우회: cat ./.env 차단'])
out.push(['DENY',  verdict('cat .env.local'),              '우회: cat .env.local 차단'])
out.push(['DENY',  verdict('cat config/.env.production'),  '우회: 경로 하위 .env 차단'])
out.push(['DENY',  verdict('grep KEY .env'),               '우회: grep KEY .env 차단'])
out.push(['DENY',  verdict('grep -i secret .env.local'),   '우회: grep .env.local 차단'])
out.push(['DENY',  verdict('cat .env | grep KEY'),         '우회: 파이프 첫 서브커맨드 차단'])
// ── FP 가드: 정상 파일은 여전히 통과(과차단 없음) ──
out.push(['ALLOW', verdict('cat src/app.js'),              'FP가드: 정상 cat 통과'])
out.push(['ALLOW', verdict('cat environment.ts'),          'FP가드: environment.ts(.env 아님) 통과'])
out.push(['ALLOW', verdict('grep TODO src/index.ts'),      'FP가드: 정상 grep 통과'])
// ── Read 도구 deny도 유지(#237 기존 통제 회귀 방지) ──
out.push(['yes', deny.includes('Read(**/.env)') ? 'yes' : 'no',   '회귀: Read(**/.env) deny 유지'])
out.push(['yes', deny.includes('Read(**/.env.*)') ? 'yes' : 'no', '회귀: Read(**/.env.*) deny 유지'])

for (const [w, g, d] of out) console.log(`${w}|${g}|${d}`)
NODE

if [ ! -s "$TMP" ]; then echo "FAIL: node 판정 산출 없음(파싱 오류?)"; exit 1; fi

while IFS='|' read -r want got desc; do
  [ -z "$desc" ] && continue
  if [ "$want" = "$got" ]; then echo "PASS: $desc (=$got)"; PASS=$((PASS+1))
  else echo "FAIL: $desc — want $want, got $got"; FAIL=$((FAIL+1)); fi
done < "$TMP"

echo ""
echo "결과: PASS=$PASS FAIL=$FAIL"
[ "$FAIL" -eq 0 ]
