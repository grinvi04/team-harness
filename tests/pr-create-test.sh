#!/bin/bash
# tests/pr-create-test.sh — pr-create.sh 순수 검증 함수(valid_title_body·is_base_branch) 단위 검증.
# 순수 PR 생성 계약 + 실제 리뷰 helper/skill receiver 계약(fake gh/git만 실행).
# 로컬·CI 동일: bash tests/pr-create-test.sh
set -u
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PC="$ROOT/plugins/harness-guard/scripts/pr-create.sh"
PASS=0; FAIL=0

tb() { # desc, title, body, want_rc(0=OK, 2=XOR 거절)
  local desc="$1" t="$2" b="$3" want="$4" rc
  rc=$(PRCREATE_SOURCE_ONLY=1 bash -c 'source "$1"; if valid_title_body "$2" "$3"; then echo 0; else echo $?; fi' _ "$PC" "$t" "$b")
  if [ "$rc" = "$want" ]; then echo "PASS: $desc"; PASS=$((PASS+1)); else echo "FAIL: $desc — want $want got $rc"; FAIL=$((FAIL+1)); fi
}
bb() { # desc, branch, want_rc(0=base=거절, 1=허용)
  local desc="$1" br="$2" want="$3" rc
  rc=$(PRCREATE_SOURCE_ONLY=1 bash -c 'source "$1"; if is_base_branch "$2"; then echo 0; else echo 1; fi' _ "$PC" "$br")
  if [ "$rc" = "$want" ]; then echo "PASS: $desc"; PASS=$((PASS+1)); else echo "FAIL: $desc — want $want got $rc"; FAIL=$((FAIL+1)); fi
}

# title/body: 둘 다 있거나 둘 다 없으면 OK(0), 한쪽만(XOR)이면 rc2로 선거절
tb "title+body 둘 다 → 0"       t  b   0
tb "둘 다 생략(--fill) → 0"     "" ""  0
tb "title만(body 없음) → rc2"   t  ""  2
tb "body만(title 없음) → rc2"   "" b   2

# base 브랜치(main/develop) → 거절(rc0), feature/fix → 허용(rc1)
bb "main → base(거절 0)"        main       0
bb "develop → base(거절 0)"     develop    0
bb "feature/x → 허용(1)"        feature/x  1
bb "fix/y → 허용(1)"            fix/y      1

# Q2A: review processing only mutates explicit snapshot IDs; actual helper, fake gh effects.
if node - "$ROOT" <<'NODETHREAD'
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const root = process.argv[2];
const helper = path.join(root, 'plugins/harness-guard/skills/pr-review-gate/review-thread-scope.mjs');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'q2a-threads-'));
const bin = path.join(tmp, 'bin'); fs.mkdirSync(bin);
fs.writeFileSync(path.join(bin, 'gh'), String.raw`#!/usr/bin/env node
const fs = require('node:fs');
const p = process.env.Q2A_STATE;
const s = JSON.parse(fs.readFileSync(p, 'utf8'));
const a = process.argv.slice(2);
s.calls.push(a);
const save = () => fs.writeFileSync(p, JSON.stringify(s));
const emit = x => { save(); console.log(JSON.stringify(x)); };
const value = flag => a[a.indexOf(flag) + 1];
if (a[0] === 'repo' && a[1] === 'view') { save(); console.log('test/repo');
} else if (a[0] === 'pr' && a[1] === 'checks') { save(); console.log('quality\tpass\t1s\thttp://fake');
} else if (a[0] === 'pr' && a[1] === 'merge') { s.merges = [...(s.merges || []), a]; save(); console.log('fake merge');
} else if (a[0] === 'pr' && a[1] === 'view') {
 if (s.metadataFail) { save(); process.exit(1); }
 if (s.metadataMalformed) { save(); console.log('{bad'); process.exit(0); }
 const field = value('--json');
 if (field === 'mergeable') { save(); console.log('MERGEABLE'); }
 else if (field.includes(',')) emit(s.candidate);
 else { save(); console.log(s.candidate[field] || ''); }
} else if (a[0] === 'api' && a[1] !== 'graphql') {
 const comment = Number(a[1].match(/comments\/(\d+)\/replies$/)?.[1]);
 if (!comment) { save(); process.exit(9); }
 s.replies.push({ comment, body: a.find(x => x.startsWith('body='))?.slice(5) });
 if (s.replyFail) { save(); process.exit(1); }
 if (s.driftAfterReply) s.candidate.headRefOid = 'e'.repeat(40);
 emit({ id: 1001, in_reply_to_id: s.replyWrongRoot ? 999 : comment });
} else if (a[0] === 'api' && a[1] === 'graphql') {
 const q = a.find(x => x.startsWith('query=')) || '';
 if (q.includes('mutation')) {
  const id = a.find(x => x.startsWith('id='))?.slice(3);
  s.resolves.push(id);
  const t = s.threads.find(x => x.id === id);
  if (!t || s.resolveFail) { save(); process.exit(1); }
  t.isResolved = !s.resolveFalse;
  emit({ data: { resolveReviewThread: { thread: { id, isResolved: t.isResolved } } } });
 } else {
  if (s.threadFail || (s.finalThreadFail && s.resolves.length)) { save(); process.exit(1); }
  let threads = s.threads.map(t => ({ id: t.id, isResolved: t.isResolved, comments: { nodes: [{ databaseId: t.commentId }] } }));
  const after = a.find(x => x.startsWith('after='));
  const hasNextPage = !!s.paged && !after;
  if (s.paged) threads = after ? threads.slice(1) : threads.slice(0, 1);
  if (s.driftDuringSnapshot) s.candidate.baseRefOid = 'e'.repeat(40);
  emit(s.threadMalformed ? { data: null } : { data: { repository: { pullRequest: { reviewThreads: { nodes: threads, pageInfo: { hasNextPage: s.missingCursor || hasNextPage, endCursor: s.missingCursor ? null : hasNextPage ? 'page-2' : null } } } } } });
 }
} else { save(); process.exit(9); }
`, { mode: 0o755 });
const candidate = { baseRefName: 'develop', baseRefOid: 'b'.repeat(40), headRefName: 'fix/candidate', headRefOid: 'a'.repeat(40) };
let tested = 0;
try {
 for (const scenario of ['normal', 'new-thread', 'empty-processed', 'out-of-snapshot', 'duplicate-processed', 'duplicate-snapshot', 'wrong-root', 'wrong-repo', 'wrong-pr', 'processed-candidate', 'head-drift', 'base-drift', 'metadata-fail', 'metadata-malformed', 'thread-fail', 'thread-malformed', 'duplicate-live', 'missing-reply', 'missing-evidence', 'reply-fail', 'resolve-fail', 'resolve-false', 'drift-after-reply', 'already-resolved', 'new-thread-second-page', 'duplicate-live-second-page', 'invalid-thread-id', 'invalid-comment-id', 'invalid-candidate-oid', 'missing-cursor', 'reply-wrong-root', 'final-thread-fail']) {
  const dir = path.join(tmp, scenario); fs.mkdirSync(dir);
  const statePath = path.join(dir, 'state.json');
  let state = { candidate: { ...candidate }, threads: [{ id: 'PRRT_reviewed', commentId: 101, isResolved: false }], replies: [], resolves: [], calls: [] };
  fs.writeFileSync(statePath, JSON.stringify(state));
  const env = { ...process.env, PATH: bin + path.delimiter + process.env.PATH, Q2A_STATE: statePath };
  const snapshotPath = path.join(dir, 'snapshot.json');
  const run = args => spawnSync(process.execPath, [helper, ...args], { env, encoding: 'utf8' });
  let result = run(['snapshot', '--repo', 'test/repo', '--pr', '42', '--output', snapshotPath]);
  assert.equal(result.status, 0, scenario + ' snapshot: ' + result.stderr);
  let snapshot = JSON.parse(fs.readFileSync(snapshotPath, 'utf8'));
  assert.deepEqual(snapshot.candidate, candidate);
  assert.deepEqual(snapshot.threads, [{ id: 'PRRT_reviewed', commentId: 101 }]);
  const processed = { repo: 'test/repo', pr: 42, candidate: { ...candidate }, threads: [{ threadId: 'PRRT_reviewed', reply: 'Fixed and tested the reported branch.', evidence: 'local regression result for ' + candidate.headRefOid }] };
  state = JSON.parse(fs.readFileSync(statePath, 'utf8')); state.calls = [];
  if (['new-thread', 'new-thread-second-page'].includes(scenario)) state.threads.push({ id: 'PRRT_new', commentId: 202, isResolved: false });
  if (scenario === 'empty-processed') processed.threads = [];
  if (scenario === 'out-of-snapshot') processed.threads.push({ threadId: 'PRRT_new', reply: 'Not reviewed', evidence: 'none' });
  if (scenario === 'duplicate-processed') processed.threads.push({ ...processed.threads[0] });
  if (scenario === 'duplicate-snapshot') snapshot.threads.push({ ...snapshot.threads[0] });
  if (scenario === 'wrong-root') state.threads[0].commentId = 999;
  if (scenario === 'wrong-repo') processed.repo = 'other/repo';
  if (scenario === 'wrong-pr') processed.pr = 43;
  if (scenario === 'processed-candidate') processed.candidate.headRefOid = 'c'.repeat(40);
  if (scenario === 'head-drift') state.candidate.headRefOid = 'c'.repeat(40);
  if (scenario === 'base-drift') state.candidate.baseRefOid = 'd'.repeat(40);
  if (scenario === 'metadata-fail') state.metadataFail = true;
  if (scenario === 'metadata-malformed') state.metadataMalformed = true;
  if (scenario === 'thread-fail') state.threadFail = true;
  if (scenario === 'thread-malformed') state.threadMalformed = true;
  if (scenario === 'duplicate-live') state.threads.push({ ...state.threads[0] });
  if (scenario === 'missing-reply') delete processed.threads[0].reply;
  if (scenario === 'missing-evidence') delete processed.threads[0].evidence;
  if (scenario === 'reply-fail') state.replyFail = true;
  if (scenario === 'resolve-fail') state.resolveFail = true;
  if (scenario === 'resolve-false') state.resolveFalse = true;
  if (scenario === 'drift-after-reply') state.driftAfterReply = true;
  if (scenario === 'already-resolved') state.threads[0].isResolved = true;
  if (scenario === 'new-thread-second-page') state.paged = true;
  if (scenario === 'duplicate-live-second-page') { state.threads.push({ ...state.threads[0] }); state.paged = true; }
  if (scenario === 'invalid-thread-id') processed.threads[0].threadId = 123;
  if (scenario === 'invalid-comment-id') snapshot.threads[0].commentId = '101';
  if (scenario === 'invalid-candidate-oid') state.candidate.headRefOid = 123;
  if (scenario === 'missing-cursor') state.missingCursor = true;
  if (scenario === 'reply-wrong-root') state.replyWrongRoot = true;
  if (scenario === 'final-thread-fail') state.finalThreadFail = true;
  fs.writeFileSync(snapshotPath, JSON.stringify(snapshot));
  fs.writeFileSync(statePath, JSON.stringify(state));
  const processedPath = path.join(dir, 'processed.json'); fs.writeFileSync(processedPath, JSON.stringify(processed));
  result = run(['resolve', '--snapshot', snapshotPath, '--processed', processedPath]);
  state = JSON.parse(fs.readFileSync(statePath, 'utf8'));
  const success = ['normal', 'already-resolved'].includes(scenario);
  assert.equal(result.status, success ? 0 : 1, scenario + ': ' + result.stdout + result.stderr);
  const replied = ['normal', 'new-thread', 'reply-fail', 'resolve-fail', 'resolve-false', 'drift-after-reply', 'reply-wrong-root', 'new-thread-second-page', 'final-thread-fail'].includes(scenario);
  const resolved = ['normal', 'new-thread', 'resolve-fail', 'resolve-false', 'new-thread-second-page', 'final-thread-fail'].includes(scenario);
  assert.deepEqual(state.replies.map(x => x.comment), replied ? [101] : [], scenario + ' reply scope');
  assert.deepEqual(state.resolves, resolved ? ['PRRT_reviewed'] : [], scenario + ' resolve scope');
  if (replied) assert.equal(state.replies[0].body, processed.threads[0].reply, scenario + ' exact message');
  if (['new-thread', 'new-thread-second-page'].includes(scenario)) assert.equal(state.threads[1].isResolved, false, 'new thread remained unresolved');
  if (process.env.Q2A_EVIDENCE_DIR) fs.writeFileSync(path.join(process.env.Q2A_EVIDENCE_DIR, 'thread-' + scenario + '.json'), JSON.stringify({ scenario, status: result.status, stdout: result.stdout, stderr: result.stderr, snapshot, processed, state }, null, 2));
  tested++;
 }
 for (const scenario of ['snapshot-query-fail', 'snapshot-duplicate-id', 'snapshot-drift', 'snapshot-existing-output']) {
  const dir = path.join(tmp, scenario); fs.mkdirSync(dir);
  const statePath = path.join(dir, 'state.json');
  const state = { candidate: { ...candidate }, threads: [{ id: 'PRRT_reviewed', commentId: 101, isResolved: false }], replies: [], resolves: [], calls: [] };
  if (scenario === 'snapshot-query-fail') state.metadataFail = true;
  if (scenario === 'snapshot-duplicate-id') state.threads.push({ ...state.threads[0] });
  if (scenario === 'snapshot-drift') state.driftDuringSnapshot = true;
  fs.writeFileSync(statePath, JSON.stringify(state));
  const output = path.join(dir, 'snapshot.json');
  if (scenario === 'snapshot-existing-output') fs.writeFileSync(output, 'PRESERVE');
  const result = spawnSync(process.execPath, [helper, 'snapshot', '--repo', 'test/repo', '--pr', '42', '--output', output], { env: { ...process.env, PATH: bin + path.delimiter + process.env.PATH, Q2A_STATE: statePath }, encoding: 'utf8' });
  assert.equal(result.status, 1, scenario + ': snapshot should fail');
  if (scenario === 'snapshot-existing-output') assert.equal(fs.readFileSync(output, 'utf8'), 'PRESERVE');
  else assert.equal(fs.existsSync(output), false, scenario + ': no success snapshot');
  const finalState = JSON.parse(fs.readFileSync(statePath, 'utf8'));
  assert.deepEqual(finalState.resolves, []); assert.deepEqual(finalState.replies, []);
  if (process.env.Q2A_EVIDENCE_DIR) fs.writeFileSync(path.join(process.env.Q2A_EVIDENCE_DIR, scenario + '.json'), JSON.stringify({ scenario, status: result.status, stdout: result.stdout, stderr: result.stderr, state: finalState }, null, 2));
  tested++;
 }
 // Execute the shipped skill's snapshot/template/resolve/merge blocks as one real receiver flow.
 const workflowDir = path.join(tmp, 'skill-workflow'); fs.mkdirSync(workflowDir);
 const workflowState = path.join(workflowDir, 'state.json');
 fs.writeFileSync(workflowState, JSON.stringify({ candidate: { ...candidate }, threads: [{ id: 'PRRT_reviewed', commentId: 101, isResolved: false }], replies: [], resolves: [], calls: [] }));
 fs.writeFileSync(path.join(bin, 'git'), '#!/bin/sh\nexit 1\n', { mode: 0o755 });
 const skill = fs.readFileSync(path.join(root, 'plugins/harness-guard/skills/pr-review-gate/SKILL.md'), 'utf8');
 const blocks = [...skill.matchAll(/```bash\n([\s\S]*?)\n```/g)].map(x => x[1]);
 const initial = blocks.find(x => x.includes('REVIEW_DIR='));
 const template = blocks.find(x => x.includes('threads: []'));
 const processing = `node - "$PROCESSED_REVIEW" <<'NODEFILL'
const fs=require('node:fs'); const p=process.argv[2]; const d=JSON.parse(fs.readFileSync(p,'utf8')); d.threads=[{threadId:'PRRT_reviewed',reply:'Verified fix.',evidence:'same candidate regression PASS'}]; fs.writeFileSync(p,JSON.stringify(d));
NODEFILL`;
 const resolving = blocks.find(x => x.includes('node "$REVIEW_SCOPE" resolve'));
 const merging = blocks.find(x => x.includes('--expected-head'));
 assert.ok(initial && template && resolving && merging, 'executable skill receiver blocks');
 const shellQuote = value => "'" + value.replaceAll("'", "'\"'\"'") + "'";
 for (const value of ['ordinary', 'with spaces', 'dollar-$HOME', 'with $(printf SUBSTITUTED)', 'with `printf SUBSTITUTED`', "with 'quote", 'with "quote']) {
  const literal = spawnSync('bash', ['-c', `printf '%s' ${shellQuote(value)}`], { encoding: 'utf8' });
  assert.equal(literal.status, 0); assert.equal(literal.stdout, value, 'bootstrap path quoting must preserve literal text');
 }
 const pluginRoot = path.join(root, 'plugins/harness-guard');
 const runtime = fs.readFileSync(path.join(pluginRoot, 'runtime-path.md'), 'utf8');
 const bootstrap = [...runtime.matchAll(/```bash\n([\s\S]*?)\n```/g)][0][1]
  .replace("'<현재 읽은 SKILL.md의 절대 경로>'", shellQuote(path.join(pluginRoot, 'skills/pr-review-gate/SKILL.md')))
  .replace("'<그 SKILL.md가 속한 플러그인의 절대 경로>'", shellQuote(pluginRoot));
 const workflow = [bootstrap, initial, template, processing, resolving, merging, 'rm -rf "$REVIEW_DIR"'].join('\n');
 const workflowFile = path.join(workflowDir, 'workflow.sh'); fs.writeFileSync(workflowFile, workflow + '\n');
 const workflowResult = spawnSync('bash', [workflowFile], { env: { ...process.env, PATH: bin + path.delimiter + process.env.PATH, Q2A_STATE: workflowState, PR: '42', CLAUDE_PLUGIN_ROOT: path.join(root, 'plugins/harness-guard') }, encoding: 'utf8' });
 assert.equal(workflowResult.status, 0, workflowResult.stdout + workflowResult.stderr);
 const workflowActual = JSON.parse(fs.readFileSync(workflowState, 'utf8'));
 assert.deepEqual(workflowActual.resolves, ['PRRT_reviewed']);
 assert.equal(workflowActual.merges.length, 1);
 const mergeArgs = workflowActual.merges[0];
 assert.equal(mergeArgs[mergeArgs.indexOf('--match-head-commit') + 1], candidate.headRefOid);
 if (process.env.Q2A_EVIDENCE_DIR) fs.writeFileSync(path.join(process.env.Q2A_EVIDENCE_DIR, 'skill-workflow.json'), JSON.stringify({ status: workflowResult.status, stdout: workflowResult.stdout, stderr: workflowResult.stderr, state: workflowActual }, null, 2));
 tested++;
 console.log('Q2A review thread behavioral cases: ' + tested);
} finally { fs.rmSync(tmp, { recursive: true, force: true }); }
NODETHREAD
then echo "PASS: Q2A reviewed thread runtime/effect boundaries"; PASS=$((PASS+1))
else echo "FAIL: Q2A reviewed thread runtime/effect boundaries"; FAIL=$((FAIL+1)); fi

echo ""
echo "결과: PASS=$PASS FAIL=$FAIL"
[ "$FAIL" -eq 0 ]
