#!/usr/bin/env bash
set -u

SOURCE_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
TMP="$(mktemp -d)"
# Keep HEAD and dirty-file probes private; never mutate the developer checkout.
ROOT="$TMP/repo"
git clone --quiet --no-hardlinks "$SOURCE_ROOT" "$ROOT" || exit 1
BASE_REVISION="$(git -C "$ROOT" rev-parse HEAD)"
cp "$SOURCE_ROOT/scripts/build-release-bundle.mjs" "$ROOT/scripts/build-release-bundle.mjs"
CATALOG="$ROOT/experiments/split-packaging/packages.json"
CATALOG_BACKUP="$TMP/packages.json"
SENTINEL_FILE="$ROOT/.release-bundle-dirty-sentinel-$$"
SENTINEL_VALUE="dirty-$RANDOM-$$-$(date +%s)"
cp "$CATALOG" "$CATALOG_BACKUP"
trap 'rm -rf "$TMP"' EXIT
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

if node - "$TMP/one" <<'NODE'
const fs = require('fs')
const path = require('path')
const root = process.argv[2]
const m = JSON.parse(fs.readFileSync(path.join(root, 'RELEASE-MANIFEST.json')))
const units = fs.readdirSync(path.join(root, 'packages')).sort()
if (m.schemaVersion !== 1 || m.installable !== false || m.packages.length === 0 ||
    JSON.stringify(units) !== JSON.stringify(['harness-claude-adapter', 'harness-codex-adapter', 'harness-governance-core', 'harness-workflows'])) process.exit(1)
NODE
then
  pass 'legacy schema1·네 staged package 계약'
else
  fail 'legacy schema1·네 staged package 계약'
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

mkdir "$TMP/git-bin"
REAL_GIT="$(command -v git)"
cat >"$TMP/git-bin/git" <<'SH'
#!/usr/bin/env bash
for argument in "$@"; do
  if [[ "$argument" == HEAD* ]]; then
    if [[ -e "$GIT_CALL_STATE" ]]; then
      printf '%040d\n' 0
      exit 0
    fi
    : >"$GIT_CALL_STATE"
    exec "$REAL_GIT" "$@"
  fi
done
exec "$REAL_GIT" "$@"
SH
chmod +x "$TMP/git-bin/git"
if PATH="$TMP/git-bin:$PATH" REAL_GIT="$REAL_GIT" GIT_CALL_STATE="$TMP/git-call-state" \
  node "$ROOT/scripts/build-release-bundle.mjs" --output "$TMP/pinned-commit" >/dev/null 2>&1 \
  && [[ -e "$TMP/git-call-state" ]] \
  && node - "$TMP/pinned-commit" <<'NODE'
const fs = require('fs')
const path = require('path')
const root = process.argv[2]
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'RELEASE-MANIFEST.json')))
const metadata = fs.readdirSync(path.join(root, 'packages')).map((name) =>
  JSON.parse(fs.readFileSync(path.join(root, 'packages', name, 'harness-package.json'))),
)
if (metadata.some((entry) => entry.sourcePluginCommit !== manifest.sourceCommit)) process.exit(1)
NODE
then
  pass '최초 commit SHA가 bundle·package provenance 전체에 고정'
else
  fail '단일 commit provenance 원자성'
fi

if node "$ROOT/scripts/build-release-bundle.mjs" --output "$TMP/one" >/dev/null 2>&1; then
  fail '기존 output 덮어쓰기 거부'
else
  pass '기존 output 덮어쓰기 거부'
fi

echo "LEGACY RESULT: $PASS PASS, $FAIL FAIL"

# Existing dangling links and their absent targets are user-owned output entries.
for mode in legacy source-only; do
  FLAGS=()
  [[ "$mode" == source-only ]] && FLAGS=(--source-only)
  LINK="$TMP/dangling-$mode"
  TARGET="$TMP/absent-$mode"
  ln -s "$TARGET" "$LINK" || exit 1
  if node "$ROOT/scripts/build-release-bundle.mjs" ${FLAGS[@]+"${FLAGS[@]}"} --output "$LINK" >"$TMP/dangling-$mode.log" 2>&1; then
    cat "$TMP/dangling-$mode.log"
    fail "$mode dangling output link 거부·보존"
  elif [[ -L "$LINK" && "$(readlink "$LINK")" == "$TARGET" && ! -e "$TARGET" && ! -L "$TARGET" ]]; then
    cat "$TMP/dangling-$mode.log"
    pass "$mode dangling output link 거부·보존"
  else
    cat "$TMP/dangling-$mode.log"
    fail "$mode dangling output link 거부·보존"
  fi
done

# A private recorded revision without the experiment catalog must still bundle source.
git -C "$ROOT" rm --quiet experiments/split-packaging/packages.json || exit 1
TREE="$(git -C "$ROOT" write-tree)"
REVISION="$(printf '%s\n' 'fixture: catalog absent' | git -C "$ROOT" -c user.name=Fixture -c user.email=fixture@example.invalid commit-tree "$TREE" -p HEAD)" || exit 1
git -C "$ROOT" update-ref HEAD "$REVISION" || exit 1
printf '%s\n' "throw new Error('SOURCE_ONLY_MUST_NOT_CALL_BUILDER')" >"$ROOT/scripts/build-packages.mjs"
if node "$ROOT/scripts/build-release-bundle.mjs" --source-only --output "$TMP/source" >"$TMP/source.log" 2>&1; then
  pass 'source-only는 catalog 없이 builder 호출 없이 생성'
  if node - "$TMP/source" "$REVISION" "$RECORDED_VERSION" "$SENTINEL_VALUE" <<'NODE'
const fs = require('fs')
const path = require('path')
const { execFileSync } = require('child_process')
const { createHash } = require('crypto')
const [root, revision, version, sentinel] = process.argv.slice(2)
const m = JSON.parse(fs.readFileSync(path.join(root, 'RELEASE-MANIFEST.json')))
const archive = fs.readFileSync(path.join(root, m.sourceArchive.path))
if (m.schemaVersion !== 1 || m.installable !== false || m.sourceCommit !== revision || m.version !== version ||
    JSON.stringify(m.packages) !== '[]' || fs.existsSync(path.join(root, 'packages')) ||
    m.sourceArchive.sha256 !== createHash('sha256').update(archive).digest('hex') ||
    archive.includes(Buffer.from(sentinel))) process.exit(1)
const builderPath = 'scripts/build-packages.mjs'
const archivedBuilder = execFileSync('tar', ['-xOf', path.join(root, m.sourceArchive.path), `team-harness-v${version}/${builderPath}`])
const recordedBuilder = execFileSync('git', ['--no-replace-objects', 'show', `${revision}:${builderPath}`], { cwd: path.join(root, '..', 'repo') })
if (!archivedBuilder.equals(recordedBuilder) || archivedBuilder.includes(Buffer.from('SOURCE_ONLY_MUST_NOT_CALL_BUILDER'))) process.exit(1)
const expectedFile = path.join(root, '..', 'expected.tar')
execFileSync('git', ['--no-replace-objects', 'archive', '--format=tar', `--prefix=team-harness-v${version}/`, '-o', expectedFile, revision], { cwd: path.join(root, '..', 'repo') })
if (!archive.equals(fs.readFileSync(expectedFile))) process.exit(1)
NODE
  then pass 'source-only schema·버전·SHA·archive·dirty 격리'; else fail 'source-only manifest/source 계약'; fi
  if (cd "$TMP/source" && shasum -a 256 -c SHA256SUMS >/dev/null); then pass 'source-only checksum 전수 검증'; else fail 'source-only checksum'; fi
  if PATH="$TMP/git-bin:$PATH" REAL_GIT="$REAL_GIT" GIT_CALL_STATE="$TMP/source-git-state" \
    node "$ROOT/scripts/build-release-bundle.mjs" --output "$TMP/source-pinned" --source-only >/dev/null 2>&1 \
    && diff -ru "$TMP/source" "$TMP/source-pinned" >/dev/null; then pass 'source-only 단일 SHA·옵션 순서·byte 재현'; else fail 'source-only 단일 SHA 고정'; fi
  if node "$ROOT/scripts/build-release-bundle.mjs" --source-only --output "$TMP/source" >/dev/null 2>&1; then fail 'source-only 기존 output 거부'; else pass 'source-only 기존 output 거부'; fi
else
  cat "$TMP/source.log"
  fail 'source-only는 catalog 없이 builder 호출 없이 생성'
fi

for mode in legacy source-only; do
  FLAGS=()
  [[ "$mode" == source-only ]] && FLAGS=(--source-only)
  for invalid in unknown duplicate-output duplicate-source missing-output; do
    case "$invalid" in
      unknown) ARGS=(--output "$TMP/rejected" --unknown) ;;
      duplicate-output) ARGS=(--output "$TMP/rejected" --output "$TMP/other") ;;
      duplicate-source) ARGS=(--output "$TMP/rejected" --source-only --source-only) ;;
      missing-output) ARGS=(--output) ;;
    esac
    if node "$ROOT/scripts/build-release-bundle.mjs" ${FLAGS[@]+"${FLAGS[@]}"} "${ARGS[@]}" >/dev/null 2>&1; then fail "$mode 잘못된 인수 거부: $invalid"; else pass "$mode 잘못된 인수 거부: $invalid"; fi
 done
  if node "$ROOT/scripts/build-release-bundle.mjs" ${FLAGS[@]+"${FLAGS[@]}"} --output "$TMP/failed-$mode" >/dev/null 2>&1; then
    [[ "$mode" == source-only ]] || fail 'legacy catalog 누락 거부'
  elif [[ "$mode" == legacy ]]; then
    pass 'legacy catalog 누락 거부'
  fi
done
# Force archive failure after temporary output creation in each mode.
git -C "$ROOT" update-ref HEAD "$BASE_REVISION" || exit 1
cat >"$TMP/git-bin/git" <<'SH'
#!/usr/bin/env bash
for argument in "$@"; do
  if [[ "$argument" == archive ]]; then
    echo 'FORCED_ARCHIVE_FAILURE' >&2
    exit 1
  fi
done
exec "$REAL_GIT" "$@"
SH
for mode in legacy source-only; do
  FLAGS=()
  [[ "$mode" == source-only ]] && FLAGS=(--source-only)
  if PATH="$TMP/git-bin:$PATH" REAL_GIT="$REAL_GIT" node "$ROOT/scripts/build-release-bundle.mjs" ${FLAGS[@]+"${FLAGS[@]}"} --output "$TMP/partial-$mode" >"$TMP/partial-$mode.log" 2>&1; then
    fail "$mode 중간 실패 차단"
  elif grep -q FORCED_ARCHIVE_FAILURE "$TMP/partial-$mode.log" && [[ ! -e "$TMP/partial-$mode" ]] && ! compgen -G "$TMP/.team-harness-release-*" >/dev/null; then
    pass "$mode 미완성 output 정리"
  else
    fail "$mode 미완성 output 정리"
  fi
done
[[ ! -e "$TMP/rejected" && ! -e "$TMP/other" ]] && pass '인수 거부 시 output 없음' || fail '잘못된 인수의 output 생성'
echo "RESULT: $PASS PASS, $FAIL FAIL"
[[ "$FAIL" -eq 0 ]]
