// Controller-owned evidence for Harness acceptance tests, not a consumer task engine.
import { createHash } from 'node:crypto';
import { lstat, readdir, readFile } from 'node:fs/promises';
import path from 'node:path';

export const digest = value => createHash('sha256').update(value).digest('hex');
const relative = value => typeof value === 'string' && value.length > 0 && !path.isAbsolute(value)
  && !value.split('/').some(part => !part || part === '.' || part === '..') && !/[\\\x00-\x1f]/.test(value);
const sensitive = name => /^(\.env(?:\..*)?|\.ssh|\.aws|auth\.json|credentials(?:\.json)?)$/i.test(name);
const verdictSet = new Set(['PASS', 'FAIL', 'UNVERIFIED']);

export async function snapshot(root, { exclude = [] } = {}) {
  if (!path.isAbsolute(root) || !Array.isArray(exclude) || !exclude.every(relative)) throw new Error('invalid observation boundary');
  const files = [];
  async function visit(name) {
    if (name && exclude.some(item => name === item || name.startsWith(`${item}/`))) return;
    const target = path.join(root, name), stat = await lstat(target);
    if (stat.isSymbolicLink()) throw new Error(`symlink observation refused: ${name || root}`);
    if (name && sensitive(path.basename(name))) throw new Error(`sensitive path requires explicit exclusion: ${name}`);
    if (stat.isDirectory()) {
      for (const child of (await readdir(target)).sort()) await visit(name ? `${name}/${child}` : child);
    } else if (stat.isFile()) {
      files.push({ path: name, digest: digest(await readFile(target)), mode: stat.mode & 0o777 });
    } else throw new Error(`non-regular observation refused: ${name}`);
  }
  await visit('');
  return { root, files, exclude: [...exclude] };
}

export function compareSnapshots(before, after, { allowed = [] } = {}) {
  if (before.root !== after.root || !allowed.every(relative)) throw new Error('observation root/allowance mismatch');
  const left = new Map(before.files.map(file => [file.path, file]));
  const right = new Map(after.files.map(file => [file.path, file]));
  if (left.size !== before.files.length || right.size !== after.files.length) throw new Error('duplicate observed path');
  const changes = [];
  for (const name of [...new Set([...left.keys(), ...right.keys()])].sort()) {
    const a = left.get(name), b = right.get(name);
    const kind = !a ? 'added' : !b ? 'deleted' : a.digest !== b.digest || a.mode !== b.mode ? 'modified' : null;
    if (kind) changes.push({ path: name, kind });
  }
  const verdict = changes.some(row => !allowed.includes(row.path)) ? 'FAIL'
    : before.exclude.length || after.exclude.length ? 'UNVERIFIED' : 'PASS';
  return { verdict, changes };
}

function candidateValid(value) {
  return value && typeof value.root === 'string' && path.isAbsolute(value.root)
    && /^[0-9a-f]{40}$/.test(value.head) && /^[0-9a-f]{64}$/.test(value.dirtyDigest)
    && /^[0-9a-f]{64}$/.test(value.contractDigest);
}
const candidateSame = (a, b) => candidateValid(a) && candidateValid(b)
  && ['root', 'head', 'dirtyDigest', 'contractDigest'].every(key => a[key] === b[key]);
const aggregate = rows => rows.some(row => row.required && row.verdict === 'FAIL') ? 'FAIL'
  : rows.some(row => row.required && row.verdict !== 'PASS') ? 'UNVERIFIED' : 'PASS';

export function adjudicate({ criteria, candidate, observations }) {
  if (!Array.isArray(criteria) || !criteria.length || !candidateValid(candidate) || !Array.isArray(observations)) throw new Error('invalid criterion evidence contract');
  const ids = new Set();
  for (const criterion of criteria) {
    if (!criterion || typeof criterion.id !== 'string' || !criterion.id.trim() || ids.has(criterion.id)
      || typeof criterion.required !== 'boolean' || typeof criterion.command !== 'string' || !criterion.command.trim()
      || typeof criterion.cwd !== 'string' || !path.isAbsolute(criterion.cwd)
      || !Number.isInteger(criterion.expectedExit ?? 0) || (criterion.expectedExit ?? 0) < 0 || (criterion.expectedExit ?? 0) > 255) {
      throw new Error('invalid or duplicate criterion');
    }
    ids.add(criterion.id);
  }
  if (observations.some(row => !ids.has(row?.criterionId))) throw new Error('unknown observation criterion');
  const rows = criteria.map(criterion => {
    const attempts = observations.filter(row => row.criterionId === criterion.id);
    const valid = attempts.length > 0 && attempts.every((row, index) => candidateSame(row.candidate, candidate)
      && row.cwd === criterion.cwd && row.command === criterion.command && row.attempt === index + 1
      && Number.isInteger(row.exitCode) && row.exitCode >= 0 && row.exitCode <= 255
      && typeof row.output === 'string' && row.outputDigest === digest(row.output));
    const verdict = !valid ? 'UNVERIFIED' : attempts.some(row => row.exitCode !== (criterion.expectedExit ?? 0)) ? 'FAIL' : 'PASS';
    return { ...criterion, verdict, attempts: structuredClone(attempts) };
  });
  return { criterionIds: [...ids], candidate: { ...candidate }, criteria: rows, verdict: aggregate(rows) };
}

export function renderMarkdown(result) {
  const { criterionIds: ids, criteria: rows } = result;
  if (!Array.isArray(ids) || !ids.length || !Array.isArray(rows) || rows.length !== ids.length
    || new Set(ids).size !== ids.length || new Set(rows.map(row => row.id)).size !== ids.length
    || rows.some(row => !ids.includes(row.id) || !verdictSet.has(row.verdict) || typeof row.required !== 'boolean')
    || aggregate(rows) !== result.verdict) throw new Error('inconsistent criterion result aggregate');
  const escape = value => String(value).replaceAll('|', '\\|').replace(/[\r\n]/g, ' ');
  return `Overall: ${result.verdict}\n\n| Criterion | Required | Verdict | Attempts |\n|---|---|---|---|\n`
    + rows.map(row => `| ${escape(row.id)} | ${row.required} | ${row.verdict} | ${row.attempts.length} |`).join('\n') + '\n';
}
