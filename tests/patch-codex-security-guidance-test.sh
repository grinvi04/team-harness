#!/usr/bin/env bash
# Legacy optional compatibility requires explicit application; startup must not
# rewrite third-party cache, marketplace, or enablement without that choice.
set -euo pipefail

ROOT=$(cd "$(dirname "$0")/.." && pwd)
PATCHER="$ROOT/plugins/harness-guard/scripts/patch-codex-security-guidance.mjs"
TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT

for hooks in \
  "$TMP/.codex/plugins/cache/claude-plugins-official/security-guidance/2.0.6/hooks/hooks.json" \
  "$TMP/.codex/.tmp/marketplaces/claude-plugins-official/plugins/security-guidance/hooks/hooks.json"; do
  mkdir -p "$(dirname "$hooks")"
  cat >"$hooks" <<'JSON'
{
  "hooks": {
    "SessionStart": [{"hooks": [{"type": "command", "command": "bash \"${CLAUDE_PLUGIN_ROOT}/hooks/sg-python.sh\" \"${CLAUDE_PLUGIN_ROOT}/hooks/ensure_agent_sdk.py\""}]}],
    "Stop": [{"hooks": [{"type": "command", "command": "bash \"${CLAUDE_PLUGIN_ROOT}/hooks/sg-python.sh\" \"${CLAUDE_PLUGIN_ROOT}/hooks/security_reminder_hook.py\"", "asyncRewake": true, "rewakeMessage": "old", "rewakeSummary": "old"}]}]
  }
}
JSON
done

cat >"$TMP/.codex/config.toml" <<'TOML'
[plugins."security-guidance@claude-plugins-official"]
enabled = false
TOML

node - "$TMP" <<'NODE'
const fs = require('node:fs');
const root = process.argv[2];
const paths = [
  '.codex/plugins/cache/claude-plugins-official/security-guidance/2.0.6/hooks/hooks.json',
  '.codex/.tmp/marketplaces/claude-plugins-official/plugins/security-guidance/hooks/hooks.json',
  '.codex/config.toml',
];
fs.writeFileSync(`${root}/before.json`, JSON.stringify(paths.map(path => [path, fs.readFileSync(`${root}/${path}`, 'utf8')])));
NODE

assert_unchanged() {
  node - "$TMP" <<'NODE'
const fs = require('node:fs');
const root = process.argv[2];
for (const [path, before] of JSON.parse(fs.readFileSync(`${root}/before.json`))) {
  if (fs.readFileSync(`${root}/${path}`, 'utf8') !== before) throw new Error(`unexpected write: ${path}`);
  if (fs.readdirSync(require('node:path').dirname(`${root}/${path}`)).some(name => name.includes('.backup.'))) throw new Error(`unexpected backup: ${path}`);
}
NODE
}

for args in '' '--unknown' '--apply --dry-run'; do
  set +e
  HOME="$TMP" node "$PATCHER" $args >"$TMP/refused.out" 2>"$TMP/refused.err"
  rc=$?
  set -e
  [ "$rc" = 2 ] || { echo "FAIL: explicit apply boundary ($args), rc=$rc"; exit 1; }
  assert_unchanged
  echo "PASS: rejected ambiguous/unapproved legacy invocation ($args) without writes"
done
HOME="$TMP" node "$PATCHER" --dry-run >"$TMP/dry.json"
assert_unchanged
echo 'PASS: legacy preview leaves external files and enablement unchanged'
HOME="$TMP" node "$PATCHER" --apply >"$TMP/result.json"

node - "$TMP" <<'NODE'
const fs = require('node:fs');
const root = process.argv[2];
const fail = (message) => { console.error(`FAIL: ${message}`); process.exit(1); };
const dry = JSON.parse(fs.readFileSync(`${root}/dry.json`, 'utf8'));
const result = JSON.parse(fs.readFileSync(`${root}/result.json`, 'utf8'));
if (dry.hooks.changedFiles !== 2 || result.hooks.changedFiles !== 2) fail('both Codex hook copies were not patched');
for (const path of [
  `${root}/.codex/plugins/cache/claude-plugins-official/security-guidance/2.0.6/hooks/hooks.json`,
  `${root}/.codex/.tmp/marketplaces/claude-plugins-official/plugins/security-guidance/hooks/hooks.json`,
]) {
  const hooks = JSON.parse(fs.readFileSync(path, 'utf8'));
  for (const group of Object.values(hooks.hooks).flat()) {
    for (const hook of group.hooks) {
      if (!hook.command.includes('codex-security-guidance-adapter.mjs')) fail(`${path} command bypasses adapter`);
      if ('asyncRewake' in hook || 'rewakeMessage' in hook || 'rewakeSummary' in hook) fail(`${path} Claude-only async field remains`);
    }
  }
}
if (!fs.readFileSync(`${root}/.codex/config.toml`, 'utf8').includes('enabled = true')) fail('security-guidance was not enabled');
console.log('PASS: Codex cache와 marketplace snapshot 모두 security-guidance adapter로 패치');
NODE

# Execute the fixture's registered commands, not just command-name substrings.
mkdir -p "$TMP/vendor/hooks"
cat >"$TMP/vendor/hooks/sg-python.sh" <<'SH'
#!/usr/bin/env bash
exec node "$@"
SH
cat >"$TMP/vendor/hooks/ensure_agent_sdk.py" <<'JS'
console.log(JSON.stringify({metrics:{fixture:1},systemMessage:'optional startup advisory'}));
JS
cat >"$TMP/vendor/hooks/security_reminder_hook.py" <<'JS'
console.log(JSON.stringify({metrics:{fixture:1},rewakeSummary:'legacy',decision:'block',reason:'optional stop advisory'}));
process.exit(2);
JS
node - "$TMP" <<'NODE'
const fs = require('node:fs');
const {spawnSync} = require('node:child_process');
const root = process.argv[2];
const hooks = JSON.parse(fs.readFileSync(`${root}/.codex/plugins/cache/claude-plugins-official/security-guidance/2.0.6/hooks/hooks.json`));
const records=[];
for (const [event, expectedExit, field, expectedText] of [
  ['SessionStart',0,'systemMessage','optional startup advisory'],
  ['Stop',2,'reason','optional stop advisory'],
]) {
  const command = hooks.hooks[event][0].hooks[0].command;
  const result = spawnSync('bash',['-c',command],{encoding:'utf8',input:JSON.stringify({hook_event_name:event}),env:{...process.env,CLAUDE_PLUGIN_ROOT:`${root}/vendor`}});
  records.push({event,command,status:result.status,stdout:result.stdout,stderr:result.stderr});
  if(result.status!==expectedExit) throw new Error(`${event}: wrong status ${result.status}`);
  const output=JSON.parse(result.stdout);
  if(output[field]!==expectedText || 'metrics' in output || 'rewakeSummary' in output) throw new Error(`${event}: optional guidance output changed`);
  if(event==='Stop' && (!result.stderr.includes(expectedText) || output.decision!=='block')) throw new Error('Stop continuation feedback lost');
  console.log(`PASS: explicit legacy ${event} registered command preserves advisory/continuation effect`);
}
if(process.env.HARNESS_M3E_EFFECTS_DIR) {
 fs.mkdirSync(process.env.HARNESS_M3E_EFFECTS_DIR,{recursive:true});
 fs.writeFileSync(`${process.env.HARNESS_M3E_EFFECTS_DIR}/optional-registered-advisory.json`,JSON.stringify(records,null,2)+'\n');
}
NODE

HOME="$TMP" node "$PATCHER" --apply >"$TMP/repeated.json"
node - "$TMP/repeated.json" <<'NODE'
const result=JSON.parse(require('node:fs').readFileSync(process.argv[2]));
if(result.hooks.changedFiles!==0 || result.config.changed) throw new Error('explicit repeated application is not idempotent');
console.log('PASS: explicit repeated legacy application reports no changes');
NODE

# S08: exercise the generated command with the patcher/adapter in literal paths.
# All cache/config and vendor files are synthetic; shell payloads only echo.
node - "$TMP" "$PATCHER" "$ROOT/plugins/harness-guard/scripts/codex-security-guidance-adapter.mjs" <<'NODE'
const fs = require('node:fs');
const path = require('node:path');
const {spawnSync} = require('node:child_process');
const [root, patcherSource, adapterSource] = process.argv.slice(2);
const cases = [
  ['ordinary','ordinary'],
  ['space','with space'],
  ['doublequote','with"doublequote'],
  ['dollar','with$HARNESS_M3E_PATH_VAR'],
  ['backtick','with`printf m3e-expanded`'],
  ['apostrophe',"with'apostrophe"],
];
const records=[];
let failures=0;
for(const [label, name] of cases) {
  const fixture=path.join(root,`quoted-${label}`);
  const scripts=path.join(fixture,name);
  const home=path.join(fixture,'home');
  const vendor=path.join(fixture,'vendor');
  const hooksFile=path.join(home,'.codex/plugins/cache/claude-plugins-official/security-guidance/2.0.6/hooks/hooks.json');
  const copiedPatcher=path.join(scripts,'patch-codex-security-guidance.mjs');
  fs.mkdirSync(scripts,{recursive:true});
  fs.mkdirSync(path.dirname(hooksFile),{recursive:true});
  fs.mkdirSync(path.join(vendor,'hooks'),{recursive:true});
  fs.copyFileSync(patcherSource,copiedPatcher);
  fs.copyFileSync(adapterSource,path.join(scripts,'codex-security-guidance-adapter.mjs'));
  fs.writeFileSync(path.join(vendor,'hooks/sg-python.sh'),'#!/usr/bin/env bash\nexec node "$@"\n');
  fs.writeFileSync(path.join(vendor,'hooks/advisory.mjs'),'console.log(JSON.stringify({metrics:{fixture:1},systemMessage:"literal-path advisory"}));\n');
  fs.writeFileSync(hooksFile,JSON.stringify({hooks:{SessionStart:[{hooks:[{type:'command',command:'bash "${CLAUDE_PLUGIN_ROOT}/hooks/sg-python.sh" "${CLAUDE_PLUGIN_ROOT}/hooks/advisory.mjs"'}]}]}})+'\n');
  fs.writeFileSync(path.join(home,'.codex/config.toml'),'[plugins."security-guidance@claude-plugins-official"]\nenabled = false\n');
  const env={...process.env,HOME:home,CLAUDE_PLUGIN_ROOT:vendor,HARNESS_M3E_PATH_VAR:'m3e-expanded'};
  const patch=spawnSync(process.execPath,[copiedPatcher,'--apply'],{encoding:'utf8',env});
  let command='';
  let result={status:null,stdout:'',stderr:''};
  let output;
  if(patch.status===0) {
    command=JSON.parse(fs.readFileSync(hooksFile,'utf8')).hooks.SessionStart[0].hooks[0].command;
    result=spawnSync('bash',['-c',command],{encoding:'utf8',env,input:'{"hook_event_name":"SessionStart"}'});
    try { output=JSON.parse(result.stdout); } catch {}
  }
  records.push({label,adapterPath:path.join(scripts,'codex-security-guidance-adapter.mjs'),patchStatus:patch.status,patchStderr:patch.stderr,registeredCommand:command,status:result.status,stdout:result.stdout,stderr:result.stderr});
  if(patch.status!==0 || result.status!==0 || output?.systemMessage!=='literal-path advisory' || 'metrics' in (output||{})) {
    console.error(`FAIL: S08 ${label} registered command failed (patch=${patch.status}, hook=${result.status})`);
    failures++;
  } else {
    console.log(`PASS: S08 ${label} adapter path stays literal in actual registered command`);
  }
}
if(process.env.HARNESS_M3E_EFFECTS_DIR) {
  fs.mkdirSync(process.env.HARNESS_M3E_EFFECTS_DIR,{recursive:true});
  fs.writeFileSync(`${process.env.HARNESS_M3E_EFFECTS_DIR}/path-registered-advisory.json`,JSON.stringify(records,null,2)+'\n');
}
console.log(`S08 path results: PASS=${cases.length-failures} FAIL=${failures}`);
process.exit(failures ? 1 : 0);
NODE
