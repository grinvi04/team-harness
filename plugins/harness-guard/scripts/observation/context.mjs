import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
const hash = value => createHash('sha256').update(value).digest('hex');
export const sessionId = value => typeof value === 'string' && /^[a-zA-Z0-9][a-zA-Z0-9_.:-]{0,127}$/.test(value) ? value : null;
export function resolveContext(cwd = process.cwd(), session = null) {
  try {
    const git = args => {
      const r = spawnSync('git', args, { cwd, encoding: 'utf8', timeout: 250, killSignal: 'SIGKILL', maxBuffer: 8192 });
      if (r.status !== 0 || r.error) throw Error('CONTEXT_UNAVAILABLE');
      return r.stdout.trim();
    };
    const repo = fs.realpathSync(git(['rev-parse', '--path-format=absolute', '--git-common-dir']));
    const worktree = fs.realpathSync(git(['rev-parse', '--show-toplevel']));
    const head = git(['rev-parse', '--verify', 'HEAD']);
    if (!/^(?:[a-f0-9]{40}|[a-f0-9]{64})$/.test(head)) return null;
    return { repoId: hash(repo), worktreeId: hash(worktree), hostSessionId: sessionId(session), headSha: head, baseSha: null };
  } catch { return null; }
}
