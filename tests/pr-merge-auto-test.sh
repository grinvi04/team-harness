#!/bin/bash
# tests/pr-merge-auto-test.sh — 순수 판정 + 실제 머지 래퍼의 후보/게이트 경계 검증(fake gh/git).
#  ① --auto base 정책(require_develop_base)  ② 게이트 본체(classify_ci_gate·gate_threads·gate_mergeable).
# PRMERGE_SOURCE_ONLY로 함수만 로드해 값 주입 검증한다(gh 호출 없이 판정 로직만).
# 로컬·CI 동일: bash tests/pr-merge-auto-test.sh
set -u
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
GATE="$ROOT/plugins/harness-guard/scripts/pr-merge.sh"
PASS=0; FAIL=0

check() { # desc, base, want_rc
  local desc="$1" base="$2" want="$3" rc
  rc=$(PRMERGE_SOURCE_ONLY=1 bash -c 'source "$1"; if require_develop_base "$2" >/dev/null 2>&1; then echo 0; else echo $?; fi' _ "$GATE" "$base")
  if [ "$rc" = "$want" ]; then echo "PASS: $desc"; PASS=$((PASS+1)); else echo "FAIL: $desc — expected $want, got $rc"; FAIL=$((FAIL+1)); fi
}

# AC-2/AC-3: --auto는 develop 전용 — develop만 통과, 그 외 거부(exit 3)
check "base=develop → 통과(0)"     develop     0
check "base=main → 거부(3)"        main        3
check "base=release/v1 → 거부(3)"  release/v1  3

# ── D1: 게이트 본체 순수 판정 함수 (gh 호출과 분리한 seam) ──
# classify_ci_gate: (rc, out) → 판정 문자열(green/none/fallback/fail)
ci() { # desc, rc, out, want
  local desc="$1" rc="$2" out="$3" want="$4" got
  got=$(PRMERGE_SOURCE_ONLY=1 bash -c 'source "$1"; classify_ci_gate "$2" "$3"' _ "$GATE" "$rc" "$out")
  if [ "$got" = "$want" ]; then echo "PASS: $desc"; PASS=$((PASS+1)); else echo "FAIL: $desc — expected $want, got $got"; FAIL=$((FAIL+1)); fi
}
# gate_threads / gate_mergeable: 인자 → rc(0 통과 / 1 중단)
grc() { # desc, fn, arg, want_rc
  local desc="$1" fn="$2" arg="$3" want="$4" rc
  rc=$(PRMERGE_SOURCE_ONLY=1 bash -c 'source "$1"; if "$2" "$3" >/dev/null 2>&1; then echo 0; else echo 1; fi' _ "$GATE" "$fn" "$arg")
  if [ "$rc" = "$want" ]; then echo "PASS: $desc"; PASS=$((PASS+1)); else echo "FAIL: $desc — expected $want, got $rc"; FAIL=$((FAIL+1)); fi
}

# CI 판정: rc0=green, 'no checks'/'no required'=none, 접근불가=fallback, 그 외=fail(중단)
ci "CI rc=0 → green"                        0 "any output"                             green
ci "CI 'no checks' → none(통과)"            1 "no checks reported on the 'abc' commit"  none
ci "CI 'no required' → none(통과)"          1 "no required checks"                      none
ci "CI 'Resource not accessible' → fallback" 1 "Resource not accessible by integration" fallback
ci "CI 'GraphQL' 403 → fallback"            1 "GraphQL: Resource not accessible"        fallback
ci "CI 실패 출력 → fail(중단)"              1 "1 failing, 2 successful, 0 skipped"      fail
# #199: 실패 체크의 '이름'에 GraphQL 등 에러토큰이 들어간 표 행 → fallback 오판 아니라 fail(상태컬럼 우선)
ci "CI 실패 체크명 GraphQL(표 행) → fail"    1 "$(printf 'GraphQL schema check\tfail\t20s\thttp://x')" fail
ci "CI pending 체크(표 행) → fail(미통과)"   1 "$(printf 'quality\tpending\t\thttp://x')"              fail
# 실제 API 에러(표 행 아님)는 여전히 fallback
ci "CI GraphQL 에러문(표 아님) → fallback"   1 "GraphQL: Resource not accessible by integration"      fallback

# 미해결 스레드: "0"만 통과, 나머지(ERR·1+·빈값) fail-CLOSED
grc "threads=0 → 통과"          gate_threads   0            0
grc "threads=1 → 중단"          gate_threads   1            1
grc "threads=ERR → 중단(fail-closed)" gate_threads ERR      1
grc "threads='' → 중단(fail-closed)"  gate_threads ""       1
# GraphQL 페이지 응답은 미해결 수·다음 cursor·계속 여부를 손실 없이 반환한다.
tps() { # desc json want
  local desc="$1" json="$2" want="$3" got
  got=$(PRMERGE_SOURCE_ONLY=1 bash -c 'source "$1"; printf "%s" "$2" | thread_page_state' _ "$GATE" "$json")
  if [ "$got" = "$want" ]; then echo "PASS: $desc"; PASS=$((PASS+1)); else echo "FAIL: $desc — want '$want' got '$got'"; FAIL=$((FAIL+1)); fi
}
tps "첫 페이지 100개 뒤 다음 cursor 보존" '{"data":{"repository":{"pullRequest":{"reviewThreads":{"nodes":[{"isResolved":false},{"isResolved":true}],"pageInfo":{"hasNextPage":true,"endCursor":"c100"}}}}}}' '1|true|c100'
tps "마지막 페이지 종료" '{"data":{"repository":{"pullRequest":{"reviewThreads":{"nodes":[{"isResolved":false}],"pageInfo":{"hasNextPage":false,"endCursor":"c101"}}}}}}' '1|false|c101'
if PRMERGE_SOURCE_ONLY=1 bash -c 'source "$1"; printf "%s" "$2" | thread_page_state' _ "$GATE" '{"data":{"repository":{"pullRequest":{"reviewThreads":{"nodes":[],"pageInfo":{"hasNextPage":null,"endCursor":null}}}}}}' >/dev/null 2>&1; then
  echo "FAIL: null hasNextPage가 마지막 페이지로 통과"; FAIL=$((FAIL+1))
else
  echo "PASS: null hasNextPage fail-closed"; PASS=$((PASS+1))
fi
if command -v jq >/dev/null 2>&1; then
  D=$(mktemp -d); trap 'rm -rf "$D"' EXIT
  printf '#!/bin/sh\ncat >/dev/null\nexit 1\n' > "$D/python3"; chmod +x "$D/python3"
  got=$(PATH="$D:$PATH" PRMERGE_SOURCE_ONLY=1 bash -c 'source "$1"; printf "%s" "$2" | thread_page_state' _ "$GATE" '{"data":{"repository":{"pullRequest":{"reviewThreads":{"nodes":[{"isResolved":false}],"pageInfo":{"hasNextPage":false,"endCursor":"c101"}}}}}}')
  [ "$got" = '1|false|c101' ] && { echo "PASS: python 소비실패 후 jq fallback은 원 입력 재사용"; PASS=$((PASS+1)); } || { echo "FAIL: parser fallback fail-open — '$got'"; FAIL=$((FAIL+1)); }
fi
# 실제 cursor loop: 첫 100개 뒤 c100을 전달하고 101번째 미해결을 합산한다.
LOOP_STATE=$(mktemp); printf 0 > "$LOOP_STATE"
loopout=$(PRMERGE_SOURCE_ONLY=1 bash -c '
source "$1"; first="$2"; second="$3"; state_file="$4"
gh(){ calls=$(cat "$state_file"); calls=$((calls+1)); printf %s "$calls" > "$state_file"; if [ "$calls" = 1 ]; then printf "%s" "$first"; else case "$*" in *"after=c100"*) printf "%s" "$second";; *) return 1;; esac; fi; }
count_unresolved_threads o r 42
' _ "$GATE" '{"data":{"repository":{"pullRequest":{"reviewThreads":{"nodes":[],"pageInfo":{"hasNextPage":true,"endCursor":"c100"}}}}}}' '{"data":{"repository":{"pullRequest":{"reviewThreads":{"nodes":[{"isResolved":false}],"pageInfo":{"hasNextPage":false,"endCursor":"c101"}}}}}}' "$LOOP_STATE")
rm -f "$LOOP_STATE"
[ "$loopout" = 1 ] && { echo "PASS: 101번째 미해결 스레드 cursor 합산"; PASS=$((PASS+1)); } || { echo "FAIL: 2페이지 합산 — '$loopout'"; FAIL=$((FAIL+1)); }
# mergeable: "MERGEABLE"만 통과
grc "mergeable=MERGEABLE → 통과"   gate_mergeable MERGEABLE   0
grc "mergeable=CONFLICTING → 중단" gate_mergeable CONFLICTING 1
grc "mergeable=UNKNOWN → 중단"     gate_mergeable UNKNOWN     1

# --auto 안전 계약: required 없음/조회 불가는 거부. 명시 수동 머지의 기존 fallback은 유지.
ac() { # desc, verdict, auto, want_rc
  local desc="$1" v="$2" a="$3" want="$4" rc
  rc=$(PRMERGE_SOURCE_ONLY=1 bash -c 'source "$1"; if auto_ci_ok "$2" "$3"; then echo 0; else echo 1; fi' _ "$GATE" "$v" "$a")
  if [ "$rc" = "$want" ]; then echo "PASS: $desc"; PASS=$((PASS+1)); else echo "FAIL: $desc — want $want got $rc"; FAIL=$((FAIL+1)); fi
}
ac "none + --auto → 거부(fail-closed)"   none  1  1
ac "none + 수동(auto=0) → 허용"          none  0  0
ac "green + --auto → 허용"               green 1  0
ac "fail + --auto → 허용(정상 fail 경로)" fail  1  0
ac "fallback + --auto → 거부(fail-closed)" fallback 1 1
ac "fallback + 수동(auto=0) → 허용"      fallback 0 0

# 머지 후 로컬 정리 checkout 결정: 현재가 삭제될 head면 base로 이동(빈 base=develop), 아니면 이동 불필요("")
mcc() { # desc, head, base, current, want
  local desc="$1" head="$2" base="$3" cur="$4" want="$5" got
  got=$(PRMERGE_SOURCE_ONLY=1 bash -c 'source "$1"; merge_cleanup_checkout "$2" "$3" "$4"' _ "$GATE" "$head" "$base" "$cur")
  if [ "$got" = "$want" ]; then echo "PASS: $desc"; PASS=$((PASS+1)); else echo "FAIL: $desc — want '$want' got '$got'"; FAIL=$((FAIL+1)); fi
}
mcc "현재=head → base로 이동"       feature/x  develop feature/x  develop
mcc "현재=head, base=main → main"   release/v1 main    release/v1 main
mcc "현재≠head → 이동 불필요('')"   feature/x  develop develop    ""
mcc "빈 base → develop 폴백"        feature/x  ""      feature/x  develop

# Candidate JSON and parser fallback exercise actual decoding, including typed OID rejection.
CANDIDATE_JSON='{"baseRefName":"develop","baseRefOid":"bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb","headRefName":"fix/candidate","headRefOid":"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"}'
CANDIDATE_WANT='develop|bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb|fix/candidate|aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'
parsed=$(PRMERGE_SOURCE_ONLY=1 bash -c 'source "$1"; printf "%s" "$2" | pr_candidate_state' _ "$GATE" "$CANDIDATE_JSON")
[ "$parsed" = "$CANDIDATE_WANT" ] && { echo "PASS: Q2A JSON candidate name/OID decoding"; PASS=$((PASS+1)); } || { echo "FAIL: Q2A JSON candidate decoding"; FAIL=$((FAIL+1)); }
if PRMERGE_SOURCE_ONLY=1 bash -c 'source "$1"; printf "%s" "$2" | pr_candidate_state' _ "$GATE" '{"baseRefName":"develop","baseRefOid":123,"headRefName":"fix/x","headRefOid":"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"}' >/dev/null 2>&1; then
  echo "FAIL: Q2A numeric OID accepted"; FAIL=$((FAIL+1))
else echo "PASS: Q2A numeric OID rejected"; PASS=$((PASS+1)); fi
if command -v jq >/dev/null 2>&1; then
  parsed=$(PATH="$D:$PATH" PRMERGE_SOURCE_ONLY=1 bash -c 'source "$1"; printf "%s" "$2" | pr_candidate_state' _ "$GATE" "$CANDIDATE_JSON")
  [ "$parsed" = "$CANDIDATE_WANT" ] && { echo "PASS: Q2A candidate jq fallback reuses original JSON"; PASS=$((PASS+1)); } || { echo "FAIL: Q2A candidate jq fallback"; FAIL=$((FAIL+1)); }
fi

# Q2A: invoke the real wrapper; every gh/git side effect is a PATH-scoped fake.
WRAPPER_TMP=$(mktemp -d)
trap 'rm -rf "${D:-}" "$WRAPPER_TMP"' EXIT
mkdir -p "$WRAPPER_TMP/bin"
cat > "$WRAPPER_TMP/bin/gh" <<'PYGH'
#!/usr/bin/env python3
import json, os, sys
from pathlib import Path
args=sys.argv[1:]; root=Path(os.environ['Q2A_CASE_DIR']); scenario=os.environ['Q2A_SCENARIO']
with (root/'calls.jsonl').open('a') as f: f.write(json.dumps(args)+'\n')
def emit(value): print(json.dumps(value))
if args[:2]==['repo','view']: print('test/repo')
elif args[:2]==['pr','checks']:
 if scenario in ['ci-none','ci-none-manual']: print('no required checks'); sys.exit(1)
 if scenario=='ci-pending': print('quality\tpending\t\thttp://fake'); sys.exit(1)
 if scenario in ['fallback','fallback-manual']: print('Resource not accessible by integration'); sys.exit(1)
 print('quality\tpass\t1s\thttp://fake')
elif args[:2]==['run','list']: emit([{'headSha':'a'*40,'status':'completed','conclusion':'success','name':'unrelated informational workflow'}])
elif args[:2]==['api','graphql']:
 emit({'data':{'repository':{'pullRequest':{'reviewThreads':{'nodes':[{'isResolved':False}] if scenario=='unresolved' else [],'pageInfo':{'hasNextPage':False,'endCursor':None}}}}}})
elif args[:2]==['pr','view']:
 field=args[args.index('--json')+1]
 candidate={'baseRefName':'main' if scenario=='auto-main' else 'develop','baseRefOid':'b'*40,'headRefName':'fix/candidate','headRefOid':'a'*40}
 done=(root/'gate-passed').exists()
 if done and scenario=='head-drift': candidate['headRefOid']='c'*40
 if done and scenario=='base-oid-drift': candidate['baseRefOid']='d'*40
 if done and scenario=='base-name-drift': candidate['baseRefName']='main'
 if field=='mergeable':
  (root/'gate-passed').touch(); print('CONFLICTING' if scenario=='conflicting' else 'MERGEABLE')
 elif field=='number': print(42)
 elif ',' in field:
  if scenario=='initial-query-fail' or (done and scenario=='final-query-fail'): sys.exit(1)
  if scenario=='initial-malformed' or (done and scenario=='final-malformed'): print('{broken')
  elif scenario=='oid-type': candidate['headRefOid']=123; emit(candidate)
  elif scenario=='oid-malformed': candidate['baseRefOid']='not-a-commit'; emit(candidate)
  else: emit(candidate)
 else: print(candidate.get(field,''))
elif args[:2]==['pr','merge']: print('fake merge recorded')
else: print('unexpected fake gh arguments',args,file=sys.stderr); sys.exit(9)
PYGH
cat > "$WRAPPER_TMP/bin/git" <<'SHGIT'
#!/bin/sh
# No real Git operation (including cleanup) is allowed in this wrapper test.
exit 1
SHGIT
chmod +x "$WRAPPER_TMP/bin/gh" "$WRAPPER_TMP/bin/git"
wrapper_case() { # scenario expected exit expected merge count
  local scenario="$1" want="$2" merges="$3" case_dir="$WRAPPER_TMP/$1" rc=0
  local args=(42 --auto)
  case "$scenario" in
    fallback-manual|ci-none-manual) args=(42);;
    reviewed-normal) args+=(--expected-head "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" --expected-base-oid "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb");;
    reviewed-head-mismatch) args+=(--expected-head "cccccccccccccccccccccccccccccccccccccccc");;
    reviewed-base-mismatch) args+=(--expected-base-oid "dddddddddddddddddddddddddddddddddddddddd");;
  esac
  mkdir -p "$case_dir"
  : > "$case_dir/calls.jsonl"
  PATH="$WRAPPER_TMP/bin:$PATH" Q2A_SCENARIO="$scenario" Q2A_CASE_DIR="$case_dir" \
    bash "$GATE" "${args[@]}" > "$case_dir/output.log" 2>&1 || rc=$?
  if [ -n "${Q2A_EVIDENCE_DIR:-}" ]; then
    cp "$case_dir/calls.jsonl" "$Q2A_EVIDENCE_DIR/merge-$scenario-calls.jsonl"
    cp "$case_dir/output.log" "$Q2A_EVIDENCE_DIR/merge-$scenario-output.log"
  fi
  if python3 - "$case_dir" "$scenario" "$rc" "$want" "$merges" <<'PYASSERT'
import json,sys
from pathlib import Path
root,scenario,actual,want,merges=sys.argv[1:]
assert actual==want, f'{scenario}: expected exit {want}, got {actual}'
calls=[json.loads(s) for s in (Path(root)/'calls.jsonl').read_text().splitlines()]
merge=[c for c in calls if c[:2]==['pr','merge']]
assert len(merge)==int(merges), f'{scenario}: merge writes {len(merge)}, expected {merges}'
if scenario in ['fallback','ci-none']:
 assert not any(c[:2]==['run','list'] for c in calls), f'{scenario}: auto used unverified Actions fallback'
if scenario=='fallback-manual':
 assert sum(c[:2]==['run','list'] for c in calls)==1, 'manual fallback did not inspect head Actions runs'
if merge:
 args=merge[0]
 assert '--match-head-commit' in args, f'{scenario}: merge did not bind reviewed head'
 assert args[args.index('--match-head-commit')+1]=='a'*40, f'{scenario}: wrong merge candidate'
 meta=[c for c in calls if c[:2]==['pr','view'] and 'baseRefOid' in c[c.index('--json')+1]]
 assert len(meta)==2, f'{scenario}: expected pre/post gate metadata snapshots'
 if scenario=='fallback-manual':
  assert not any(c[:2]==['pr','view'] and c[c.index('--json')+1] in ['headRefOid','headRefName'] for c in calls[:calls.index(args)]), 'fallback re-read a different head'
PYASSERT
  then echo "PASS: Q2A real wrapper $scenario"; PASS=$((PASS+1))
  else echo "FAIL: Q2A real wrapper $scenario"; cat "$case_dir/output.log"; FAIL=$((FAIL+1)); fi
}
wrapper_case reviewed-normal 0 1
wrapper_case reviewed-head-mismatch 1 0
wrapper_case reviewed-base-mismatch 1 0
wrapper_case normal 0 1
wrapper_case fallback 1 0
wrapper_case fallback-manual 0 1
wrapper_case head-drift 1 0
wrapper_case base-oid-drift 1 0
wrapper_case base-name-drift 1 0
wrapper_case final-query-fail 1 0
wrapper_case final-malformed 1 0
wrapper_case initial-query-fail 1 0
wrapper_case initial-malformed 1 0
wrapper_case oid-type 1 0
wrapper_case oid-malformed 1 0
wrapper_case auto-main 3 0
wrapper_case ci-none 1 0
wrapper_case ci-none-manual 0 1
wrapper_case ci-pending 1 0
wrapper_case unresolved 1 0
wrapper_case conflicting 1 0

echo ""
echo "결과: PASS=$PASS FAIL=$FAIL"
[ "$FAIL" -eq 0 ]
