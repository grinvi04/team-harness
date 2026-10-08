#!/bin/bash
# Compatibility no-op contract; native actual execution is separate evidence.
set -eu
HERE="$(cd "$(dirname "$0")" && pwd)"
HOOK="${HOOK:-$HERE/../plugins/harness-guard/scripts/enforce-subagent-model.py}"
python3 - "$HOOK" <<'PY'
import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile

hook = Path(sys.argv[1]).resolve()
with tempfile.TemporaryDirectory(prefix='native-model-noop-') as temporary:
    home = Path(temporary)
    log = home / 'audit.log'
    log.write_bytes(b'preserve audit bytes\n')
    env = dict(os.environ, HOME=str(home), HARNESS_SUBAGENT_MODEL_LOG=str(log))
    failures = []
    cases = []
    for kind in ('Explore', 'general-purpose', 'claude', 'Plan', 'harness-guard:verifier', 'harness-guard:security-reviewer', 'unknown'):
        for model in (None, 'inherit', 'opus', 'sonnet', 'haiku', 'unsupported-model'):
            tool_input = {'subagent_type': kind}
            if model is not None:
                tool_input['model'] = model
            cases.append((f'{kind}/{model}', json.dumps({'tool_name': 'Agent', 'tool_input': tool_input})))
    cases += [('malformed', 'not json'), ('array', '[]'), ('null', 'null'), ('shape', '{"tool_name":"Agent","tool_input":[]}'), ('non-Agent', '{"tool_name":"Bash"}'), ('empty', '')]
    before = sorted((str(p.relative_to(home)), p.read_bytes()) for p in home.rglob('*') if p.is_file())
    for label, payload in cases:
        # Prevent the interpreter's bytecode cache from masquerading as hook writes.
        result = subprocess.run([sys.executable, '-B', str(hook)], input=payload, text=True, capture_output=True, env=env)
        after = sorted((str(p.relative_to(home)), p.read_bytes()) for p in home.rglob('*') if p.is_file())
        ok = result.returncode == 0 and result.stdout == '' and result.stderr == '' and after == before
        print(('PASS' if ok else 'FAIL') + ': native selection untouched ' + label)
        if not ok:
            failures.append({'case': label, 'exit': result.returncode, 'stdout': result.stdout, 'stderr': result.stderr, 'log_changed': after != before, 'after_paths': [name for name, _ in after]})
    if failures:
        print(json.dumps(failures, indent=2))
        raise SystemExit(1)
    print('48 compatibility cases; no model override, output, or audit mutation. This is not native model execution proof.')
PY
