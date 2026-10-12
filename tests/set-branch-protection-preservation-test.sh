#!/usr/bin/env bash
# Offline company policy fixtures: no credentials or network.
set -euo pipefail
ROOT=$(cd "$(dirname "$0")/.." && pwd)
TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT
mkdir "$TMP/bin"
cat > "$TMP/bin/gh" <<'PY'
#!/usr/bin/env python3
import json,os,sys
from pathlib import Path
args=sys.argv[1:]; endpoint=next((x for x in args if x.startswith('repos/')), '')
method=args[args.index('-X')+1] if '-X' in args else 'GET'
p=Path(os.environ['FIXTURE']); scenario=os.environ.get('SCENARIO','ok')
with (p/'calls').open('a') as f: f.write(method+' '+endpoint+'\n')
branch='develop' if '/develop' in endpoint else 'main'
if '/rulesets' in endpoint:
    if scenario=='rules-error': sys.exit(1)
    if scenario=='rules-malformed': print('{}'); sys.exit()
    print(json.dumps([{'id':1}] if scenario=='ruleset' else [])); sys.exit()
if endpoint.endswith('/protection'):
    if method=='PUT':
        value=json.loads(Path(args[args.index('--input')+1]).read_text()); (p/(branch+'.put')).write_text(json.dumps(value)); sys.exit()
    if scenario=='query-error' or (scenario=='develop-query-error' and branch=='develop'): sys.exit(1)
    if scenario=='malformed': print('{bad'); sys.exit()
    if scenario=='error-body': print('{"message":"API error"}'); sys.exit()
    value=json.loads((p/(branch+'.json')).read_text())
    if (p/(branch+'.put')).exists():
        value=json.loads((p/(branch+'.put')).read_text()); value['required_signatures']={'enabled':True}
        for key in list(value):
            if isinstance(value[key],bool): value[key]={'enabled':value[key]}
        if scenario=='post-drift': value['restrictions']=None
        if scenario=='post-signature-drift': value['required_signatures']['enabled']=False
        if scenario=='post-app-drift': value['required_status_checks']['checks'][0]['app_id']=7
        if scenario=='post-codeowner-drift': value['required_pull_request_reviews']['require_code_owner_reviews']=False
    print(json.dumps(value)); sys.exit()
if '/check-runs' in endpoint: print('["quality"]'); sys.exit()
print('{}')
PY
chmod +x "$TMP/bin/gh"
export FIXTURE="$TMP" PATH="$TMP/bin:$PATH"
python3 - "$TMP" <<'PY'
import json,sys
from pathlib import Path
p=Path(sys.argv[1]); value={'required_status_checks':{'strict':True,'contexts':['quality','security'],'checks':[{'context':'quality','app_id':42},{'context':'security','app_id':91}]},'enforce_admins':{'enabled':True},'required_pull_request_reviews':{'required_approving_review_count':2,'dismiss_stale_reviews':True,'require_code_owner_reviews':True,'require_last_push_approval':True,'dismissal_restrictions':{'users':[{'login':'lead'}],'teams':[{'slug':'owners'}],'apps':[]},'bypass_pull_request_allowances':{'users':[],'teams':[],'apps':[]}},'restrictions':{'users':[{'login':'lead'}],'teams':[{'slug':'owners'}],'apps':[{'slug':'ci'}]},'required_linear_history':{'enabled':True},'required_signatures':{'enabled':True},'allow_force_pushes':{'enabled':False},'allow_deletions':{'enabled':False},'required_conversation_resolution':{'enabled':True},'lock_branch':{'enabled':False},'allow_fork_syncing':{'enabled':False}}
for b in ['main','develop']: (p/(b+'.json')).write_text(json.dumps(value))
PY
PASS=0; FAIL=0
run_case() {
  local name="$1" scenario="$2" want="$3"; shift 3
  rm -f "$TMP/main.put" "$TMP/develop.put"; : > "$TMP/calls"
  local rc=0
  SCENARIO="$scenario" bash "$ROOT/plugins/harness-guard/scripts/set-branch-protection.sh" o/r "$@" >"$TMP/out" 2>&1 || rc=$?
  if [ "$rc" = "$want" ]; then echo "PASS: $name"; PASS=$((PASS+1)); else echo "FAIL: $name rc=$rc wanted=$want"; cat "$TMP/out"; FAIL=$((FAIL+1)); fi
}
no_writes() { if ! rg -q '^PUT|^PATCH|^DELETE' "$TMP/calls"; then PASS=$((PASS+1)); else echo 'FAIL: unexpected mutation'; FAIL=$((FAIL+1)); fi; }
run_case 'main-only preserves company fields' ok 0 --branches main --contexts quality
if [ -f "$TMP/main.put" ]; then
python3 - "$TMP" <<'PY'
import json,sys
from pathlib import Path
p=Path(sys.argv[1]); d=json.loads((p/'main.put').read_text()); assert not (p/'develop.put').exists(); assert 'develop' not in (p/'calls').read_text()
assert d['required_pull_request_reviews']['required_approving_review_count']==2
assert d['required_pull_request_reviews']['require_code_owner_reviews'] is True
assert d['required_pull_request_reviews']['dismissal_restrictions']['teams']==['owners']
assert d['restrictions']=={'users':['lead'],'teams':['owners'],'apps':['ci']}
assert d['required_status_checks']['checks']==[{'context':'quality','app_id':42},{'context':'security','app_id':91}]
assert d['required_linear_history'] is True
assert 'required_signatures' not in d # dedicated endpoint; preserve by leaving untouched
PY
else FAIL=$((FAIL+1)); fi
run_case 'develop approvals informational' ok 0 --check
run_case 'explicit develop approvals baseline' ok 0 --check --develop-approvals 2
run_case 'preview no writes' ok 0 --preview --branches main,develop --contexts quality
no_writes
for scenario in query-error develop-query-error malformed error-body rules-error rules-malformed ruleset; do run_case "$scenario fails before writes" "$scenario" 1 --contexts quality; no_writes; done
run_case 'approval lowering rejected' ok 1 --approvals 1 --contexts quality
no_writes
python3 - "$TMP/main.json" <<'PY'
import json,sys
p=sys.argv[1]; d=json.load(open(p)); d['unknown_policy']={'enabled':True}; json.dump(d,open(p,'w'))
PY
run_case 'unsupported field rejected' ok 1 --contexts quality
no_writes
python3 - "$TMP/main.json" <<'PY'
import json,sys
p=sys.argv[1]; d=json.load(open(p)); del d['unknown_policy']; json.dump(d,open(p,'w'))
PY
# Strengthening develop must not change main or remove other review fields.
python3 - "$TMP/develop.json" <<'PY'
import json,sys
p=sys.argv[1]; d=json.load(open(p)); d['required_pull_request_reviews']['required_approving_review_count']=1; json.dump(d,open(p,'w'))
PY
run_case 'develop approval1 informational' ok 0 --check
run_case 'default apply preserves both reviews' ok 0 --contexts quality
python3 - "$TMP" <<'PY'
import json,sys
from pathlib import Path
p=Path(sys.argv[1]); assert json.loads((p/'main.put').read_text())['required_pull_request_reviews']['required_approving_review_count']==2
assert json.loads((p/'develop.put').read_text())['required_pull_request_reviews']['required_approving_review_count']==1
PY
run_case 'explicit develop strengthens1 to2' ok 0 --develop-approvals 2 --contexts quality
python3 - "$TMP" <<'PY'
import json,sys
from pathlib import Path
p=Path(sys.argv[1]); m=json.loads((p/'main.put').read_text()); d=json.loads((p/'develop.put').read_text())
assert m['required_pull_request_reviews']['required_approving_review_count']==2
assert d['required_pull_request_reviews']['required_approving_review_count']==2
assert d['required_pull_request_reviews']['require_code_owner_reviews'] is True
PY
python3 - "$TMP/main.json" <<'PY'
import json,sys
p=sys.argv[1]; d=json.load(open(p)); d['required_pull_request_reviews']['unknown_rule']=True; json.dump(d,open(p,'w'))
PY
run_case 'nested unsupported review rule rejected' ok 1 --preview --contexts quality
no_writes
python3 - "$TMP/main.json" <<'PY'
import json,sys
p=sys.argv[1]; d=json.load(open(p)); del d['required_pull_request_reviews']['unknown_rule']; json.dump(d,open(p,'w'))
PY
run_case 'postcondition policy loss fails' post-drift 1 --branches main --contexts quality
for scenario in post-signature-drift post-app-drift post-codeowner-drift; do run_case "$scenario rejected" "$scenario" 1 --branches main --contexts quality; done
printf 'preservation: PASS=%s FAIL=%s\n' "$PASS" "$FAIL"
[ "$FAIL" -eq 0 ]
