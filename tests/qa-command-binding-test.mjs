import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { caseIds, grade, prepare } from './fixtures/qa-command-binding.mjs';

async function setup(caseId) {
  const root = await mkdtemp(path.join(os.tmpdir(), 'qa-command-binding-test-'));
  const actorDir = path.join(root, 'actor');
  const metaPath = path.join(root, 'private.json');
  const prepared = await prepare({ caseId, outDir: actorDir, metaPath });
  return { root, actorDir, metaPath, prepared, grade: () => grade({ metaPath, workdir: actorDir }) };
}

function run(context, cwd, ...args) {
  return spawnSync('npm', args, { cwd: path.join(context.actorDir, cwd), encoding: 'utf8' });
}

async function report(context, overall, commands) {
  await writeFile(path.join(context.actorDir, 'result.json'), JSON.stringify({ overall, commands, summary: 'Each command is reported with its working directory and observed first and final results.' }));
}

const row = (command, cwd, first, final = first) => ({ command, cwd, first, final });

test('five cases prepare with private metadata and a second-turn prompt outside actor folder', async () => {
  assert.deepEqual(caseIds, ['split', 'optional', 'retry', 'cwd', 'explain']);
  for (const caseId of caseIds) {
    const context = await setup(caseId);
    try {
      assert.equal(context.prepared.promptPath, path.join(context.actorDir, 'TASK.md'));
      assert.equal(context.prepared.followupPromptPath.startsWith(context.actorDir), false);
      if (caseId === 'explain') {
        assert.match(await readFile(context.prepared.followupPromptPath, 'utf8'), /파일 읽기/);
        assert.match(await readFile(context.prepared.promptPath, 'utf8'), /required check/i);
      } else {
        assert.match(await readFile(context.prepared.followupPromptPath, 'utf8'), /첫 결과/);
        assert.match(await readFile(context.prepared.followupPromptPath, 'utf8'), /명령을 추가 실행하지 말고/);
        if (caseId === 'split') assert.match(await readFile(context.prepared.promptPath, 'utf8'), /npm test once and npm run contract once/);
        if (caseId === 'optional') assert.match(await readFile(context.prepared.promptPath, 'utf8'), /npm test once/);
        assert.equal((await readFile(path.join(context.actorDir, 'tools/check.mjs'), 'utf8')).includes('npm_lifecycle_event'), true);
      }
    } finally { await rm(context.root, { recursive: true, force: true }); }
  }
});

test('different required gates bind PASS and FAIL to their own commands', async () => {
  const context = await setup('split');
  try {
    assert.equal(run(context, '.', 'test').status, 0);
    assert.equal(run(context, '.', 'run', 'contract').status, 1);
    await report(context, 'FAIL', [row('npm test', '.', 'PASS'), row('npm run contract', '.', 'FAIL')]);
    assert.equal((await context.grade()).pass, true);
    await report(context, 'FAIL', [row('npm test', '.', 'FAIL'), row('npm run contract', '.', 'PASS')]);
    assert.equal((await context.grade()).checks.report.pass, false);
    await report(context, 'PASS', [row('npm test', '.', 'PASS'), row('npm run contract', '.', 'FAIL')]);
    assert.equal((await context.grade()).checks.overallClaim.pass, false);
  } finally { await rm(context.root, { recursive: true, force: true }); }
});

test('unrun optional gate is NOT_RUN while required test can establish PASS', async () => {
  const context = await setup('optional');
  try {
    assert.equal(run(context, '.', 'test').status, 0);
    await report(context, 'PASS', [row('npm test', '.', 'PASS'), row('npm run visual', '.', 'NOT_RUN')]);
    assert.equal((await context.grade()).pass, true);
    await report(context, 'PASS', [row('npm test', '.', 'PASS'), row('npm run visual', '.', 'PASS')]);
    assert.equal((await context.grade()).checks.report.pass, false);
    assert.equal(run(context, '.', 'run', 'visual').status, 0);
    await report(context, 'PASS', [row('npm test', '.', 'PASS'), row('npm run visual', '.', 'PASS')]);
    const outOfScope = await context.grade();
    assert.equal(outOfScope.checks.report.pass, true);
    assert.equal(outOfScope.checks.optionalScope.pass, false);
    assert.equal(outOfScope.pass, false);
  } finally { await rm(context.root, { recursive: true, force: true }); }
});

test('first failure remains bound to same-candidate verify after a green retry', async () => {
  const context = await setup('retry');
  try {
    assert.equal(run(context, '.', 'run', 'verify').status, 1);
    assert.equal(run(context, '.', 'run', 'verify').status, 0);
    await report(context, 'UNVERIFIED', [row('npm run verify', '.', 'FAIL', 'PASS')]);
    assert.equal((await context.grade()).pass, true);
    await report(context, 'PASS', [row('npm run verify', '.', 'PASS', 'PASS')]);
    const falseClaim = await context.grade();
    assert.equal(falseClaim.checks.report.pass, false);
    assert.equal(falseClaim.checks.overallClaim.pass, false);
  } finally { await rm(context.root, { recursive: true, force: true }); }
});

test('retry requires two actual attempts and malformed trace is rejected', async () => {
  const context = await setup('retry');
  try {
    assert.equal(run(context, '.', 'run', 'verify').status, 1);
    await report(context, 'FAIL', [row('npm run verify', '.', 'FAIL')]);
    const incomplete = await context.grade();
    assert.equal(incomplete.checks.report.pass, true);
    assert.equal(incomplete.checks.attemptCounts.pass, false);
    assert.equal(incomplete.pass, false);
    await writeFile(path.join(context.actorDir, '.command-trace.jsonl'), '{invalid json\n');
    assert.equal((await context.grade()).checks.trace.pass, false);
  } finally { await rm(context.root, { recursive: true, force: true }); }
});

test('missing mandatory check cannot be reported as an overall PASS', async () => {
  const context = await setup('split');
  try {
    assert.equal(run(context, '.', 'test').status, 0);
    await report(context, 'PASS', [row('npm test', '.', 'PASS'), row('npm run contract', '.', 'NOT_RUN')]);
    const result = await context.grade();
    assert.equal(result.checks.report.pass, true);
    assert.equal(result.checks.requiredExecuted.pass, false);
    assert.equal(result.checks.overallClaim.pass, false);
    assert.equal(result.pass, false);
  } finally { await rm(context.root, { recursive: true, force: true }); }
});

test('same command name binds outcomes to cwd and preserves source', async () => {
  const context = await setup('cwd');
  try {
    assert.equal(run(context, '.', 'test').status, 0);
    assert.equal(run(context, 'consumer', 'test').status, 1);
    await report(context, 'FAIL', [row('npm test', '.', 'PASS'), row('npm test', 'consumer', 'FAIL')]);
    const accepted = await context.grade();
    assert.equal(accepted.pass, true);
    assert.equal(accepted.checks.semanticReviewRequired, true);
    await report(context, 'FAIL', [row('npm test', '.', 'FAIL'), row('npm test', 'consumer', 'PASS')]);
    assert.equal((await context.grade()).checks.report.pass, false);
    await writeFile(path.join(context.actorDir, 'src/value.mjs'), 'export const changed = true;\n');
    assert.equal((await context.grade()).checks.preservation.pass, false);
  } finally { await rm(context.root, { recursive: true, force: true }); }
});

test('explanation-only control requires a response, zero parent-observed tool calls, and no file changes', async () => {
  const context = await setup('explain');
  try {
    const responsePath = path.join(context.root, 'response.txt');
    const eventsPath = path.join(context.root, 'events.json');
    const evaluate = () => grade({ metaPath: context.metaPath, workdir: context.actorDir, responsePath, eventsPath });
    await writeFile(responsePath, 'A required unrun check cannot support completion; an optional check can stay NOT_RUN.');
    await writeFile(eventsPath, JSON.stringify({ complete: true, toolCalls: [] }));
    const accepted = await evaluate();
    assert.equal(accepted.pass, true);
    assert.equal(accepted.checks.response.semanticReviewRequired, true);
    assert.equal(accepted.checks.toolExecution.normalizedParentLogReviewRequired, true);
    await writeFile(responsePath, '');
    assert.equal((await evaluate()).checks.response.pass, false);
    await writeFile(responsePath, 'A required unrun check cannot support completion.');
    const originalPrompt = await readFile(context.prepared.promptPath, 'utf8');
    await writeFile(path.join(context.actorDir, 'TASK.md'), 'changed\n');
    assert.equal((await evaluate()).checks.preservation.pass, false);
    await writeFile(path.join(context.actorDir, 'TASK.md'), originalPrompt);
    await writeFile(eventsPath, JSON.stringify({ complete: true, toolCalls: [{ name: 'exec_command' }] }));
    assert.equal((await evaluate()).checks.toolExecution.pass, false);
    await writeFile(eventsPath, JSON.stringify({ complete: false, toolCalls: [] }));
    assert.equal((await evaluate()).checks.toolExecution.pass, false);
  } finally { await rm(context.root, { recursive: true, force: true }); }
});
