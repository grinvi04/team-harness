#!/usr/bin/env bash
set -u

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
TMP="$(mktemp -d)"
CATALOG="$ROOT/packaging/packages.json"
CATALOG_BACKUP="$TMP/packages.json"
SENTINEL_FILE="$ROOT/.release-bundle-dirty-sentinel-$$"
SENTINEL_VALUE="dirty-$RANDOM-$$-$(date +%s)"
cp "$CATALOG" "$CATALOG_BACKUP"
trap 'cp "$CATALOG_BACKUP" "$CATALOG" 2>/dev/null || true; rm -rf "$TMP"; rm -f "$SENTINEL_FILE"' EXIT
printf '%s\n' "$SENTINEL_VALUE" >"$SENTINEL_FILE"
PASS=0
FAIL=0
pass() { echo "PASS: $1"; PASS=$((PASS + 1)); }
fail() { echo "FAIL: $1"; FAIL=$((FAIL + 1)); }

if node "$ROOT/scripts/build-release-bundle.mjs" --output "$TMP/one"; then
  pass '첫 release bundle 생성'
else
  fail '첫 release bundle 생성'
fi
if node "$ROOT/scripts/build-release-bundle.mjs" --output "$TMP/two"; then
  pass '둘째 release bundle 생성'
else
  fail '둘째 release bundle 생성'
fi

for file in RELEASE-MANIFEST.json SHA256SUMS; do
  [[ -s "$TMP/one/$file" ]] && pass "$file 생성" || fail "$file 생성"
done

if diff -ru "$TMP/one" "$TMP/two" >/dev/null; then
  pass '동일 revision bundle byte 재현'
else
  fail '동일 revision bundle byte 재현'
fi

if (cd "$TMP/one" && shasum -a 256 -c SHA256SUMS >/dev/null); then
  pass 'SHA256 manifest 전수 검증'
else
  fail 'SHA256 manifest 전수 검증'
fi

if grep -Rq '"installable": false' "$TMP/one/packages"; then
  pass 'package 설치불가 경계 보존'
else
  fail 'package 설치불가 경계 보존'
fi

if grep -Rq "$SENTINEL_VALUE" "$TMP/one"; then
  fail 'dirty worktree 내용이 bundle에 혼입'
else
  pass 'dirty worktree 내용 격리'
fi

node - "$CATALOG" <<'NODE'
const fs = require('fs')
const file = process.argv[2]
const catalog = JSON.parse(fs.readFileSync(file))
catalog.packages[0].description = 'DIRTY CATALOG MUST NOT ENTER RELEASE BUNDLE'
fs.writeFileSync(file, `${JSON.stringify(catalog, null, 2)}\n`)
NODE
if node "$ROOT/scripts/build-release-bundle.mjs" --output "$TMP/dirty-catalog" >/dev/null 2>&1 \
  && ! grep -Rq 'DIRTY CATALOG MUST NOT ENTER RELEASE BUNDLE' "$TMP/dirty-catalog/packages"; then
  pass 'tracked dirty catalog가 recorded HEAD provenance에 혼입되지 않음'
else
  fail 'tracked dirty catalog provenance 격리'
fi
cp "$CATALOG_BACKUP" "$CATALOG"

RECORDED_VERSION="$(git -C "$ROOT" show HEAD:plugins/harness-guard/.claude-plugin/plugin.json | node -e "let s='';process.stdin.on('data',d=>s+=d);process.stdin.on('end',()=>console.log(JSON.parse(s).version))")"
if node -e "const m=require(process.argv[1]);process.exit(m.version===process.argv[2]?0:1)" "$TMP/one/RELEASE-MANIFEST.json" "$RECORDED_VERSION"; then
  pass 'bundle version도 recorded HEAD에서 파생'
else
  fail 'bundle version도 recorded HEAD에서 파생'
fi

if node "$ROOT/scripts/build-release-bundle.mjs" --output "$TMP/one" >/dev/null 2>&1; then
  fail '기존 output 덮어쓰기 거부'
else
  pass '기존 output 덮어쓰기 거부'
fi

echo "RESULT: $PASS PASS, $FAIL FAIL"
[[ "$FAIL" -eq 0 ]]
