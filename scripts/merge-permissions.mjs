#!/usr/bin/env node
// scripts/merge-permissions.mjs
import { readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { resolve } from 'path';

// rule 이름 → fragment 파일명 매핑 (null = 매핑 없음·무시)
const RULE_TO_FRAGMENT = {
  typescript: 'node',
  prisma: 'prisma',
  java: 'java',
  python: 'python',
  alembic: 'alembic',
  flyway: null,
};

/**
 * 순수 함수 — base allow 배열에 스택별 fragment 권한을 병합·dedup한다.
 *
 * @param {string[]} baseAllow       - 기존 settings.json permissions.allow
 * @param {string[]} stackRules      - rule 이름 배열 (e.g. ['typescript', 'prisma'])
 * @param {{ docker?: boolean, fragmentsDir?: string }} opts
 * @returns {string[]} 병합·dedup된 allow 배열
 */
export function mergeAllow(baseAllow, stackRules, opts = {}) {
  const { docker = false, fragmentsDir } = opts;

  // 적용할 fragment 이름 수집
  const fragmentNames = [];
  for (const rule of stackRules) {
    if (Object.prototype.hasOwnProperty.call(RULE_TO_FRAGMENT, rule)) {
      const fragName = RULE_TO_FRAGMENT[rule];
      if (fragName != null) fragmentNames.push(fragName);
    }
    // 알 수 없는 rule → 무시
  }
  if (docker) fragmentNames.push('docker');

  // fragment allow 항목 수집 (파일 없으면 무시, throw 금지)
  const fragmentItems = [];
  if (fragmentsDir) {
    for (const name of fragmentNames) {
      try {
        const raw = readFileSync(resolve(fragmentsDir, `${name}.json`), 'utf8');
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) fragmentItems.push(...parsed);
      } catch {
        // 파일 없음·파싱 실패 → 무시
      }
    }
  }

  // 순서 안정 dedup: base 먼저, 그다음 fragment 순, 중복 제거
  const seen = new Set();
  const result = [];
  for (const item of [...baseAllow, ...fragmentItems]) {
    if (!seen.has(item)) {
      seen.add(item);
      result.push(item);
    }
  }
  return result;
}

// CLI main guard
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);

  let baseFile;
  let rulesStr;
  let docker = false;
  let fragmentsDir;
  let write = false;

  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === '--base')       { baseFile      = args[++i]; }
    else if (a === '--rules') { rulesStr      = args[++i]; }
    else if (a === '--docker'){ docker        = true;      }
    else if (a === '--fragments') { fragmentsDir = args[++i]; }
    else if (a === '--write') { write         = true;      }
  }

  if (!baseFile) {
    console.error('error: --base <settings.json> is required');
    process.exit(1);
  }

  const settings = JSON.parse(readFileSync(resolve(baseFile), 'utf8'));
  const baseAllow = settings?.permissions?.allow ?? [];
  const stackRules = rulesStr ? rulesStr.split(',') : [];

  // stub: mergeAllow returns baseAllow unchanged
  const mergedAllow = mergeAllow(baseAllow, stackRules, { docker, fragmentsDir });

  const out = {
    ...settings,
    permissions: {
      ...settings.permissions,
      allow: mergedAllow,
    },
  };

  const json = JSON.stringify(out, null, 2);

  if (write) {
    writeFileSync(resolve(baseFile), json + '\n', 'utf8');
  } else {
    process.stdout.write(json + '\n');
  }
}
