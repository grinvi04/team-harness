#!/usr/bin/env bash
set -u

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
TMP="$(mktemp -d "${TMPDIR:-/tmp}/team-harness-workflow-binding.XXXXXX")" || exit 1
trap 'rm -rf "$TMP"' EXIT
PASS=0
FAIL=0

pass() { echo "PASS: $1"; PASS=$((PASS + 1)); }
fail() { echo "FAIL: $1"; FAIL=$((FAIL + 1)); }

if node "$ROOT/scripts/build-packages.mjs" --output "$TMP/output" >"$TMP/out" 2>"$TMP/err"; then
  pass "workflow binding artifact 조립"
else
  fail "workflow binding artifact 조립 실패"
  sed 's/^/  /' "$TMP/err"
fi

WORKFLOW="$TMP/output/harness-workflows"
if grep -Fq '(../../../harness-governance-core/runtime-path.md)' "$WORKFLOW/skills/loop/SKILL.md" \
  && grep -Fq '${HARNESS_GOVERNANCE_CORE_ROOT}' "$WORKFLOW/skills/loop/SKILL.md" \
  && grep -Fq '${HARNESS_GOVERNANCE_CORE_ROOT}' "$WORKFLOW/skills/loop/iteration.md" \
  && ! grep -Fq '${CLAUDE_PLUGIN_ROOT' "$WORKFLOW/skills/loop/iteration.md" \
  && grep -Fq '${HARNESS_GOVERNANCE_CORE_ROOT}' "$WORKFLOW/skills/milestone/SKILL.md" \
  && ! grep -Fq '${CLAUDE_PLUGIN_ROOT' "$WORKFLOW/skills/loop/SKILL.md" \
  && ! grep -Fq '${CLAUDE_PLUGIN_ROOT' "$WORKFLOW/skills/milestone/SKILL.md"; then
  pass "workflow가 adapter-local 경로 대신 governance core binding 사용"
else
  fail "workflow에 깨지는 plugin-local core 참조 잔존"
fi

if python3 - "$WORKFLOW/harness-package.json" <<'PY'
import json
from pathlib import Path
import sys

manifest = Path(sys.argv[1])
import re
for consumer in ["skills/loop/SKILL.md", "skills/loop/iteration.md", "skills/milestone/SKILL.md"]:
    source = manifest.parent / consumer
    link = re.search(r"\]\(([^)]+/runtime-path\.md)\)", source.read_text())
    assert link, f"missing reader link: {consumer}"
    reader = (source.parent / link.group(1)).resolve()
    assert reader == (manifest.parent.parent / "harness-governance-core/runtime-path.md").resolve()
    assert reader.is_file(), f"shared runtime reader missing: {consumer}"
data = json.loads(manifest.read_text())
actual = {
    (item.get("consumer"), item.get("environment"), item.get("unit"), item.get("target"))
    for item in data.get("runtimeBindings", [])
}
expected = {
    ("skills/loop/iteration.md", "HARNESS_GOVERNANCE_CORE_ROOT", "governance-core", "scripts/run-with-timeout.mjs"),
    ("skills/loop/iteration.md", "HARNESS_GOVERNANCE_CORE_ROOT", "governance-core", "scripts/worktree-fingerprint.mjs"),
    ("skills/loop/SKILL.md", "HARNESS_GOVERNANCE_CORE_ROOT", "governance-core", "scripts/run-with-timeout.mjs"),
    ("skills/loop/SKILL.md", "HARNESS_GOVERNANCE_CORE_ROOT", "governance-core", "scripts/worktree-fingerprint.mjs"),
    ("skills/milestone/SKILL.md", "HARNESS_GOVERNANCE_CORE_ROOT", "governance-core", "scripts/pr-create.sh"),
}
raise SystemExit(0 if actual == expected and data.get("installable") is False else 1)
PY
then
  pass "workflow metadata가 core script binding 5개 명시"
else
  fail "workflow runtime binding metadata 불완전"
fi

# Execute the built milestone command with real local Git and explicit external IO doubles.
if python3 - "$WORKFLOW" "$TMP" <<'PYTEST'
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys

workflow, temporary = map(Path, sys.argv[1:])
core = workflow.parent / 'harness-governance-core'
source = (workflow / 'skills/milestone/SKILL.md').read_text()
command = next(line for line in source.splitlines() if line.startswith('bash ') and '${HARNESS_GOVERNANCE_CORE_ROOT}/scripts/pr-create.sh' in line)
assert '--milestone "<slug>"' in command
command = command.replace('"<slug>"', '"fixture-milestone"').replace('--title "..."', '--title "packaged milestone"').replace('--body "..."', '--body "fixture AC"')
repo, origin, binary = temporary / 'consumer', temporary / 'origin.git', temporary / 'bin'
repo.mkdir(); binary.mkdir()
git, node = shutil.which('git'), shutil.which('node')
env = dict(os.environ, GIT_CONFIG_GLOBAL='/dev/null', GIT_CONFIG_NOSYSTEM='1',
           GIT_AUTHOR_NAME='Fixture', GIT_AUTHOR_EMAIL='fixture@example.invalid',
           GIT_COMMITTER_NAME='Fixture', GIT_COMMITTER_EMAIL='fixture@example.invalid')
def real_git(*args):
    result = subprocess.run([git, *args], cwd=repo, env=env, text=True, capture_output=True)
    assert result.returncode == 0, result.stderr
    return result.stdout.strip()
real_git('init', '-b', 'main'); real_git('init', '--bare', str(origin))
(repo / '.harness-policy.json').write_text(json.dumps(dict(schemaVersion=1, mode='company', branchFlow='main', autoMergeTargets=[], stackedPRs=dict(enabled=True, provider='github-gh-stack'))))
real_git('add', '.'); real_git('commit', '-m', 'fixture trunk')
real_git('remote', 'add', 'origin', str(origin)); real_git('push', 'origin', 'main')
real_git('switch', '-c', 'codex/milestone')
(repo / 'feature.txt').write_text('milestone feature')
real_git('add', '.'); real_git('commit', '-m', 'fixture layer')
state = temporary / 'calls.jsonl'
# Trace runtime argv to prove the helper came from the assembled core artifact.
(binary / 'node').write_text('#!' + sys.executable + '\n' + '''import json,os,sys
with open(os.environ['BINDING_CALLS'],'a') as f:f.write(json.dumps(['node',*sys.argv[1:]])+'\\n')
os.execv(os.environ['REAL_NODE'],[os.environ['REAL_NODE'],*sys.argv[1:]])
''')
(binary / 'git').write_text('#!' + sys.executable + '\n' + '''import os,sys
a=sys.argv[1:]
if a in [['remote','get-url','origin'],['remote','get-url','--push','--all','origin']]: print('https://github.com/fixture/repo.git')
else: os.execv(os.environ['REAL_GIT'],[os.environ['REAL_GIT'],*a])
''')
(binary / 'gh').write_text('#!' + sys.executable + '\n' + '''import json,os,subprocess,sys
a=sys.argv[1:]
with open(os.environ['BINDING_CALLS'],'a') as f:f.write(json.dumps(['gh',*a])+'\\n')
def git(*args): return subprocess.check_output([os.environ['REAL_GIT'],*args],text=True).strip()
if a==['stack','--version']: print('gh stack version 0.2.1')
elif a==['stack','view','--json']: print(json.dumps(dict(trunk='main',currentBranch='codex/milestone',branches=[dict(name='codex/milestone',head=git('rev-parse','HEAD'),base=git('rev-parse','main'),isMerged=False,isQueued=False,needsRebase=False)])))
elif a[0]=='api' and 'GET' in a and a[-1].startswith('repos/fixture/repo/pulls?'): print('[]')
elif a[:2]==['pr','create']: print('https://github.com/fixture/repo/pull/1')
else: raise RuntimeError('unexpected external IO: '+str(a))
''')
for file in binary.iterdir(): file.chmod(0o755)
env.update(PATH=str(binary)+os.pathsep+env['PATH'], HARNESS_GOVERNANCE_CORE_ROOT=str(core), BINDING_CALLS=str(state), REAL_GIT=git, REAL_NODE=node)
result = subprocess.run(['bash', '-c', command + ' --stack --base main'], cwd=repo, env=env, text=True, capture_output=True)
assert result.returncode == 0, result.stdout + result.stderr
calls = [json.loads(line) for line in state.read_text().splitlines()]
assert any(call[:2] == ['node', str(core / 'scripts/stack.mjs')] and call[2] == 'check-create' for call in calls), calls
created = [call for call in calls if call[:3] == ['gh', 'pr', 'create']]
assert len(created) == 1, calls
assert created[0][created[0].index('--milestone') + 1] == 'fixture-milestone'
assert created[0][created[0].index('--base') + 1] == 'main'
assert real_git('ls-remote', '--heads', 'origin', 'refs/heads/codex/milestone').split()[0] == real_git('rev-parse', 'HEAD')
state.write_text('')
before = real_git('ls-remote', '--heads', 'origin')
rejected = subprocess.run(['bash', '-c', command + ' --stack --base codex/other-stack'], cwd=repo, env=env, text=True, capture_output=True)
assert rejected.returncode != 0, rejected.stdout + rejected.stderr
calls = [json.loads(line) for line in state.read_text().splitlines()]
assert any(call[:2] == ['node', str(core / 'scripts/stack.mjs')] for call in calls)
assert not any(call[:3] == ['gh', 'pr', 'create'] for call in calls)
assert real_git('ls-remote', '--heads', 'origin') == before
print(json.dumps(dict(adapter=str(core / 'scripts/stack.mjs'), action='check-create',
                      base='main', milestone='fixture-milestone', github='explicit double',
                      rejectedParent='codex/other-stack', rejectionExit=rejected.returncode,
                      localBareRefsPreserved=True)))
PYTEST
then
  pass "packaged milestone → core pr-create → stack adapter 실제 호출·main trunk·milestone 전달·다른 stack 거부"
else
  fail "packaged milestone/core adapter 실행 경계"
fi

echo
echo "결과: PASS=$PASS FAIL=$FAIL"
[ "$FAIL" -eq 0 ]
