import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync, execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';

const checker = path.resolve('plugins/harness-guard/scripts/check-document-sync.mjs');
const fence = value => '```harness-doc-sync\n' + JSON.stringify(value) + '\n```\n';
const hash = value => createHash('sha256').update(value).digest('hex');
function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'document-sync-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  fs.writeFileSync(path.join(root, 'plan.md'), '- [x] 구현\n- [ ] 릴리즈\n- [ ] 조건부 보류\n- [ ] 반복 서식\n');
  fs.writeFileSync(path.join(root, 'result.md'), 'candidate result\n');
  const record = {
    version: 1,
    documents: [{ path: 'plan.md', reason: '원래 계획의 완료 결과 대조, 반복 서식 보존' }],
    items: [{ document: 'plan.md', item: '구현', state: 'done',
      evidence: { path: 'result.md', sha256: hash('candidate result\n') } }],
  };
  const run = (value = record, flags = []) => {
    fs.writeFileSync(path.join(root, 'record.md'), typeof value === 'string' ? value : fence(value));
    return spawnSync(process.execPath, [checker, '--repo', root, '--record', path.join(root, 'record.md'), ...flags], { encoding: 'utf8' });
  };
  const git = (...args) => execFileSync('git', ['-C', root, ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  return { root, record, run, git };
}
function expectFailure(result, code) {
  assert.equal(result.status, 1, result.stdout + result.stderr);
  assert.match(result.stderr, new RegExp(code));
}

test('완료 결과와 원래 스펙을 연결하고 재사용 미체크는 허용', t => {
  const { run } = fixture(t);
  const result = run();
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /declared scope only/);
});
for (const [name, change, code] of [
  ['완료 결과만 있고 원래 스펙 미갱신', f => fs.writeFileSync(path.join(f.root, 'plan.md'), '- [ ] 구현\n'), 'STATE'],
  ['문서 누락', f => fs.unlinkSync(path.join(f.root, 'plan.md')), 'PATH'],
  ['근거 누락', f => delete f.record.items[0].evidence, 'EVIDENCE'],
  ['근거 파일 변경 후 오래된 digest', f => fs.appendFileSync(path.join(f.root, 'result.md'), 'changed'), 'STALE'],
  ['완료 근거 파일 부재', f => fs.unlinkSync(path.join(f.root, 'result.md')), 'PATH'],
  ['보류 재개 조건 누락', f => Object.assign(f.record.items[0], { item: '조건부 보류', state: 'deferred' }), 'RESUME'],
  ['없는 항목', f => f.record.items[0].item = '없는 항목', 'ITEM'],
  ['중복 체크박스', f => fs.appendFileSync(path.join(f.root, 'plan.md'), '- [x] 구현\n'), 'ITEM'],
  ['문서 선언 누락', f => f.record.documents = [], 'DOCUMENTS'],
  ['비적용과 대상 선언 모순', f => f.record.noImpact = '영향 없음', 'SCHEMA'],
  ['오타 필드', f => f.record.itmes = [], 'SCHEMA'],
  ['상대 경로 탈출', f => f.record.documents[0].path = '../outside.md', 'PATH'],
  ['symlink 문서', f => { fs.symlinkSync('plan.md', path.join(f.root, 'alias.md')); f.record.documents[0].path = 'alias.md'; }, 'PATH'],
]) test(name, t => { const f = fixture(t); change(f); expectFailure(f.run(), code); });

test('명시한 비적용 사유를 허용하되 빠진 선언은 실패', t => {
  const { run } = fixture(t);
  assert.equal(run({ version: 1, noImpact: '문서에 영향 없는 내부 변수명 수정' }).status, 0);
  expectFailure(run('일반 PR 본문만 있음'), 'DECLARATION');
  expectFailure(run({ version: 1, noImpact: ' ' }), 'SCHEMA');
  expectFailure(run('```harness-doc-sync\n{}'), 'DECLARATION');
});
test('진짜 미완료와 조건부 보류는 다음 행동과 함께 허용', t => {
  const { record, run } = fixture(t);
  record.items = [
    { document: 'plan.md', item: '릴리즈', state: 'pending', resume: '담당자가 다음 릴리즈 요청 시 수행' },
    { document: 'plan.md', item: '조건부 보류', state: 'deferred', resume: '공식 runtime 지원 확보 후 재개' },
  ];
  assert.equal(run().status, 0);
});
test('PR에서 기존 스펙으로 한 번만 연결하고 CI 이벤트도 같은 검사', t => {
  const { root, record, run } = fixture(t);
  fs.writeFileSync(path.join(root, 'task.md'), fence(record));
  const pointer = { version: 1, record: 'task.md' };
  assert.equal(run(pointer).status, 0);
  fs.writeFileSync(path.join(root, 'event.json'), JSON.stringify({ pull_request: { body: fence(pointer) } }));
  const result = spawnSync(process.execPath, [checker, '--repo', root, '--event', path.join(root, 'event.json')], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  fs.writeFileSync(path.join(root, 'task.md'), fence(pointer));
  expectFailure(run(pointer), 'SCHEMA');
});
test('릴리즈 뒤 대기 잔존 거부, 정확한 후속 태그 대기와 완료 허용', t => {
  const { root, record, run, git } = fixture(t);
  git('init', '-q'); git('config', 'user.email', 'fixture@example.invalid'); git('config', 'user.name', 'fixture');
  git('add', '.'); git('commit', '-qm', 'fixture');
  const commit = git('rev-parse', 'HEAD');
  git('tag', '-a', 'v1.0.0', '-m', 'release');
  record.items = [{ document: 'plan.md', item: '릴리즈', state: 'pending', resume: '발행 담당자가 태그 확인', evidence: { tag: 'v1.0.0', commit } }];
  expectFailure(run(), 'RELEASED');
  record.items[0].evidence.tag = 'v1.1.0';
  assert.equal(run().status, 0);
  record.items[0].state = 'done'; delete record.items[0].resume;
  fs.writeFileSync(path.join(root, 'plan.md'), '- [x] 릴리즈\n');
  expectFailure(run(), 'TAG');
  record.items[0].evidence.tag = 'v1.0.0';
  assert.equal(run().status, 0);
  git('add', 'plan.md'); git('commit', '-qm', 'later');
  record.items[0].evidence.commit = git('rev-parse', 'HEAD');
  expectFailure(run(), 'ANCESTRY');
});
test('Git 저장소가 아닌 곳에서 태그 대기를 성공으로 오인하지 않음', t => {
  const { record, run } = fixture(t);
  record.items = [{ document: 'plan.md', item: '릴리즈', state: 'pending', resume: '태그 발행', evidence: { tag: 'v1', commit: 'a'.repeat(40) } }];
  expectFailure(run(), 'GIT');
});

test('PR 래퍼가 선언의 모순을 push 이전에 차단', t => {
  const { root, record } = fixture(t);
  record.items[0].item = '릴리즈';
  const body = path.join(root, 'pr.md');
  fs.writeFileSync(body, fence(record));
  const result = spawnSync('bash', [path.resolve('plugins/harness-guard/scripts/pr-create.sh'), '--title', 'test', '--body-file', body], { cwd: root, encoding: 'utf8' });
  expectFailure(result, 'STATE');
});

test('커밋 후보 검사에서 untracked 근거와 수정된 파일을 거부', t => {
  const { root, record, run, git } = fixture(t);
  git('init', '-q'); git('config', 'user.email', 'fixture@example.invalid'); git('config', 'user.name', 'fixture');
  fs.writeFileSync(path.join(root, 'base.txt'), 'base');
  git('add', 'base.txt'); git('commit', '-qm', 'base');
  expectFailure(run(record, ['--committed']), 'COMMITTED');
  const body = path.join(root, 'body.md');
  fs.writeFileSync(body, fence(record));
  const wrapper = spawnSync('bash', [path.resolve('plugins/harness-guard/scripts/pr-create.sh'), '--title', 'test', '--body-file', body], { cwd: root, encoding: 'utf8' });
  expectFailure(wrapper, 'COMMITTED');
  git('add', 'plan.md', 'result.md', 'record.md'); git('commit', '-qm', 'documents');
  assert.equal(run(record, ['--committed']).status, 0);
  fs.writeFileSync(path.join(root, 'result.md'), 'new evidence');
  record.items[0].evidence.sha256 = hash('new evidence');
  assert.equal(run(record).status, 0);
  expectFailure(run(record, ['--committed']), 'COMMITTED');
});

test('들여쓴 코드 예시는 실제 체크박스와 중복 계산하지 않음', t => {
  const { root, run } = fixture(t);
  fs.appendFileSync(path.join(root, 'plan.md'), '\n    - [x] 구현\n\n```markdown\n- [x] 구현\n```\n');
  assert.equal(run().status, 0);
  fs.writeFileSync(path.join(root, 'plan.md'), '    - [x] 구현\n');
  expectFailure(run(), 'ITEM');
});

test('들여쓴 fence 모양의 예시가 뒤의 실제 항목을 숨기지 않음', t => {
  const { root, run } = fixture(t);
  fs.writeFileSync(path.join(root, 'plan.md'), '    ```example\n\n- [x] 구현\n');
  assert.equal(run().status, 0);
});

test('직접 입력한 저장소 안 선언 파일도 커밋 후보와 결박', t => {
  const { run, git } = fixture(t);
  const original = { version: 1, noImpact: 'committed reason' };
  assert.equal(run(original).status, 0);
  git('init', '-q'); git('config', 'user.email', 'fixture@example.invalid'); git('config', 'user.name', 'fixture');
  git('add', '.'); git('commit', '-qm', 'record');
  assert.equal(run(original, ['--committed']).status, 0);
  expectFailure(run({ version: 1, noImpact: 'uncommitted changed reason' }, ['--committed']), 'COMMITTED');
});
