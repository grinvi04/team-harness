import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
const directory = dirname(fileURLToPath(import.meta.url));
let semver;
try { semver = createRequire(import.meta.url)('./node_modules/semver'); } catch { /* read-only checks never install tooling */ }
const failure = (code, action) => ({ matches: false, issues: [{ code, action }] });
export function satisfies(ecosystem, version, range, environment = {}) {
  if (typeof version !== 'string' || typeof range !== 'string') return failure('INVALID_RANGE', 'Use static string versions and ranges.');
  if (['npm', 'java', 'gradle'].includes(ecosystem)) {
    if (!semver) return failure('RANGE_PARSER_UNAVAILABLE', 'Prepare isolated Harness npm semver tooling before checking.');
    const normalized = ecosystem === 'npm' ? version : semver.coerce(version)?.version;
    if (!normalized || !semver.valid(normalized) || semver.validRange(range) === null) return failure('INVALID_RANGE', 'The official npm semver parser rejected this version or range.');
    return { matches: semver.satisfies(normalized, range), issues: [] };
  }
  const python = ecosystem === 'python', ruby = ecosystem === 'ruby';
  if (!python && !ruby) return failure('UNSUPPORTED_RANGE', 'No approved ecosystem parser is configured.');
  const command = python ? process.env.STACK_VERSION_PYTHON ?? 'python3' : process.env.STACK_VERSION_RUBY ?? 'ruby';
  const args = python ? ['-I', join(directory, 'python-ranges.py')] : [join(directory, 'ruby-ranges.rb')];
  const child = spawnSync(command, args, { input: JSON.stringify({ version, range, environment }), encoding: 'utf8', timeout: 5000, maxBuffer: 1024 * 1024 });
  let result;
  try { result = JSON.parse(child.stdout ?? ''); } catch { /* missing parser is reported below */ }
  if (child.error || !result || typeof result.matches !== 'boolean' || !Array.isArray(result.issues)) return failure('RANGE_PARSER_UNAVAILABLE', `Prepare isolated ${python ? 'Python packaging' : 'RubyGems'} tooling; project dependencies are never installed by this checker.`);
  return result;
}
