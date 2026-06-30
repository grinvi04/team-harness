#!/usr/bin/env node
// scripts/merge-permissions.mjs — base settings.json의 permissions.allow에 스택별 권한 fragment를 병합·dedup.
import { readFileSync, writeFileSync, renameSync } from 'fs';
import { fileURLToPath } from 'url';
import { resolve, dirname } from 'path';

// rule 이름 → fragment 파일명 매핑 (null = 매핑 없음·무시)
const RULE_TO_FRAGMENT = {
  typescript: 'node',
  nextjs: 'nextjs',
  vue: 'vue',
  prisma: 'prisma',
  java: 'java',
  python: 'python',
  alembic: 'alembic',
  flyway: null,
};

/**
 * 순수 함수 — base allow 배열에 스택별 fragment 권한을 병합·dedup한다.
 * @param {string[]} baseAllow  - 기존 settings.json permissions.allow
 * @param {string[]} stackRules - rule 이름 배열 (e.g. ['typescript', 'prisma'])
 * @param {{ docker?: boolean, fragmentsDir?: string }} opts
 * @returns {string[]} 병합·dedup된 allow 배열 (base 먼저, 순서 안정)
 */
export function mergeAllow(baseAllow, stackRules, opts = {}) {
  const { docker = false, fragmentsDir } = opts;

  const fragmentNames = [];
  for (const rule of stackRules) {
    if (Object.prototype.hasOwnProperty.call(RULE_TO_FRAGMENT, rule)) {
      const fragName = RULE_TO_FRAGMENT[rule];
      if (fragName != null) fragmentNames.push(fragName);
    }
    // 알 수 없는 rule → 무시
  }
  if (docker) fragmentNames.push('docker');

  const fragmentItems = [];
  if (fragmentsDir) {
    for (const name of fragmentNames) {
      let raw;
      try {
        raw = readFileSync(resolve(fragmentsDir, `${name}.json`), 'utf8');
      } catch {
        continue; // 파일 없음 → 무시
      }
      let parsed;
      try {
        parsed = JSON.parse(raw);
      } catch {
        console.error(`warning: fragment ${name}.json — JSON 파싱 실패, 건너뜀`);
        continue;
      }
      if (Array.isArray(parsed)) fragmentItems.push(...parsed);
      else console.error(`warning: fragment ${name}.json — 배열이 아님, 건너뜀`);
    }
  }

  // 순서 안정 dedup: base 먼저, 그다음 fragment 순
  const seen = new Set();
  const result = [];
  for (const item of [...baseAllow, ...fragmentItems]) {
    if (!seen.has(item)) { seen.add(item); result.push(item); }
  }
  return result;
}

// CLI
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);

  // 값 플래그: 다음 인자가 또 다른 플래그(--..)면 흡수하지 않는다(누락으로 처리).
  const takeVal = (i, set) => {
    const v = args[i + 1];
    if (v !== undefined && !v.startsWith('--')) { set(v); return i + 1; }
    return i;
  };

  let baseFile, rulesStr, fragmentsDir;
  let docker = false, write = false;

  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === '--base')            i = takeVal(i, (v) => (baseFile = v));
    else if (a === '--rules')      i = takeVal(i, (v) => (rulesStr = v));
    else if (a === '--docker')     docker = true;
    else if (a === '--fragments')  i = takeVal(i, (v) => (fragmentsDir = v));
    else if (a === '--write')      write = true;
  }

  if (!baseFile) {
    console.error('error: --base <settings.json> is required');
    process.exit(1);
  }

  // --fragments 미전달 시 스크립트 상대 기본값(templates/permissions)
  if (!fragmentsDir) {
    fragmentsDir = resolve(dirname(fileURLToPath(import.meta.url)), '../templates/permissions');
  }

  const settings = JSON.parse(readFileSync(resolve(baseFile), 'utf8'));
  const baseAllow = settings?.permissions?.allow ?? [];
  const stackRules = rulesStr ? rulesStr.split(',').map((s) => s.trim()).filter(Boolean) : [];

  const mergedAllow = mergeAllow(baseAllow, stackRules, { docker, fragmentsDir });

  const out = {
    ...settings,
    permissions: { ...settings.permissions, allow: mergedAllow },
  };
  const json = JSON.stringify(out, null, 2);

  if (write) {
    // 원자적 쓰기 — temp + rename(중단 시 원본 손상 방지)
    const target = resolve(baseFile);
    const tmp = target + '.tmp';
    writeFileSync(tmp, json + '\n', 'utf8');
    renameSync(tmp, target);
  } else {
    process.stdout.write(json + '\n');
  }
}
