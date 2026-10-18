import path from 'node:path';
import { pathToFileURL } from 'node:url';
export async function observeHook(hook, source = 'codex-hook') {
  if (!process.env.PLUGIN_DATA) return null;
  try {
    const url = process.env.HARNESS_GOVERNANCE_CORE_ROOT
      ? pathToFileURL(path.join(process.env.HARNESS_GOVERNANCE_CORE_ROOT, 'scripts/observation/client.mjs'))
      : new URL('./observation/client.mjs', import.meta.url);
    const client = await import(url.href);
    const state = client.startOperation(source, { cwd: hook?.cwd || process.cwd(), sessionId: hook?.session_id,
      dataDir: path.join(process.env.PLUGIN_DATA, 'observability') });
    if (!state) return null;
    return { state, denialReason: () => client.childGuardDenial?.(state) || 'GUARD_DENIED',
      finish: (outcome, reasonCode, exitCode) => client.finishOperation(state, { outcome, reasonCode, exitCode }) };
  } catch { return null; }
}
