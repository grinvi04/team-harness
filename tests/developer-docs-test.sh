#!/bin/bash
# 개발자 문서 세 surface(Markdown 정본·실행 HTML·소개 HTML)의 최신성·연결·접근성 계약.
set -u

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
MANIFEST="$ROOT/plugins/harness-guard/.claude-plugin/plugin.json"
INTRO="$ROOT/docs/intro.html"
GUIDE_MD="$ROOT/docs/developer-workflow.md"
GUIDE_HTML="$ROOT/docs/developer-workflow.html"
README="$ROOT/README.md"
VERSION="$(python3 -c 'import json,sys; print(json.load(open(sys.argv[1]))["version"])' "$MANIFEST")"
PASS=0
FAIL=0

pass() { echo "PASS: $1"; PASS=$((PASS + 1)); }
fail() { echo "FAIL: $1"; FAIL=$((FAIL + 1)); }

check_file() {
  if [[ -f "$2" ]]; then pass "$1"; else fail "$1 — 파일 없음: $2"; fi
}

check_contains() {
  if [[ -f "$2" ]] && grep -Eq "$3" "$2"; then pass "$1"; else fail "$1"; fi
}

check_absent() {
  if [[ -f "$2" ]] && ! grep -Eq "$3" "$2"; then pass "$1"; else fail "$1"; fi
}

echo "=== surfaces and freshness ==="
check_file "개발자 Markdown 정본" "$GUIDE_MD"
check_file "개발자 실행 HTML" "$GUIDE_HTML"
check_file "전체 소개 HTML" "$INTRO"
check_contains "intro가 현재 manifest 버전 표시" "$INTRO" "v${VERSION//./\\.}"
check_contains "개발자 HTML이 현재 manifest 버전 표시" "$GUIDE_HTML" "v${VERSION//./\\.}"
check_contains "intro가 16개 스킬 표시" "$INTRO" '스킬 16종|16 Skills'
check_contains "개발자 HTML이 16개 스킬 체계 표시" "$GUIDE_HTML" '16개 스킬|스킬 16종|16 Skills'

echo ""
echo "=== workflow contract ==="
for skill in plan feature-add feature-modify systematic-debugging verification-before-completion feature-merge release-check release; do
  check_contains "개발자 HTML이 $skill 안내" "$GUIDE_HTML" "$skill"
done
check_contains "시작 위치 안내" "$GUIDE_HTML" '시작 위치'
check_contains "완료 증거 안내" "$GUIDE_HTML" '완료 증거'
check_contains "막힘 복구 안내" "$GUIDE_HTML" '막혔을 때|막힘|차단 메시지'
check_contains "Markdown 정본 역할 표시" "$GUIDE_HTML" 'Markdown 정본|내용 정본'

echo ""
echo "=== navigation ==="
check_contains "intro → 개발자 HTML" "$INTRO" 'href="developer-workflow\.html"'
check_contains "개발자 HTML → intro" "$GUIDE_HTML" 'href="intro\.html"'
check_contains "개발자 HTML → Markdown 정본" "$GUIDE_HTML" 'href="developer-workflow\.md"'
check_contains "Markdown → 개발자 HTML" "$GUIDE_MD" '\(developer-workflow\.html\)'
check_contains "README → 개발자 HTML" "$README" '\(docs/developer-workflow\.html\)'
check_contains "README → Markdown 정본" "$README" '\(docs/developer-workflow\.md\)'

echo ""
echo "=== static accessibility ==="
check_contains "한국어 문서 언어" "$GUIDE_HTML" '<html lang="ko"'
check_contains "모바일 viewport" "$GUIDE_HTML" 'name="viewport"'
check_contains "본문 바로가기" "$GUIDE_HTML" 'class="skip-link"[^>]*href="#main-content"'
check_contains "main landmark" "$GUIDE_HTML" '<main[^>]*id="main-content"'
check_contains "내비게이션 레이블" "$GUIDE_HTML" '<nav[^>]*aria-label='
check_contains "키보드 focus 표시" "$GUIDE_HTML" ':focus-visible'
check_contains "reduced motion 존중" "$GUIDE_HTML" 'prefers-reduced-motion'
check_contains "모바일 레이아웃" "$GUIDE_HTML" '@media[^\{]*max-width'
check_absent "JavaScript 없이 동작" "$GUIDE_HTML" '<script'
check_absent "외부 런타임·폰트 의존 없음" "$GUIDE_HTML" '(src|href)="https?://'

echo ""
echo "=== local HTML links ==="
if [[ -f "$GUIDE_HTML" ]] && python3 - "$INTRO" "$GUIDE_HTML" <<'PY'
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import unquote
import sys

class Links(HTMLParser):
    def __init__(self):
        super().__init__()
        self.ids = set()
        self.hrefs = []

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if "id" in attrs:
            self.ids.add(attrs["id"])
        if tag == "a" and "href" in attrs:
            self.hrefs.append(attrs["href"])

parsed = {}
for raw in sys.argv[1:]:
    path = Path(raw)
    parser = Links()
    parser.feed(path.read_text(encoding="utf-8"))
    parsed[path.resolve()] = parser

errors = []
for source, parser in parsed.items():
    for href in parser.hrefs:
        if href.startswith(("http://", "https://", "mailto:", "tel:")):
            continue
        target_raw, _, anchor = href.partition("#")
        target = source if not target_raw else (source.parent / unquote(target_raw)).resolve()
        if not target.exists():
            errors.append(f"{source.name}: missing {href}")
            continue
        if anchor and target.suffix.lower() == ".html":
            target_parser = parsed.get(target)
            if target_parser is None:
                target_parser = Links()
                target_parser.feed(target.read_text(encoding="utf-8"))
                parsed[target] = target_parser
            if anchor not in target_parser.ids:
                errors.append(f"{source.name}: missing anchor {href}")

if errors:
    print("\n".join(errors))
    raise SystemExit(1)
PY
then
  pass "intro·개발자 HTML 로컬 링크와 anchor 유효"
else
  fail "intro·개발자 HTML 로컬 링크와 anchor 유효"
fi

echo ""
echo "결과: PASS=$PASS FAIL=$FAIL"
[[ "$FAIL" -eq 0 ]]
