#!/bin/bash
# Local configuration regression checks; these do not prove model execution.
set -eu
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
python3 - "$ROOT" <<'PY'
from pathlib import Path
import sys

root = Path(sys.argv[1])
failures = []
for name in ('verifier', 'security-reviewer'):
    path = root / 'plugins/harness-guard/agents' / (name + '.md')
    text = path.read_text()
    parts = text.split('---', 2)
    fields = dict(line.split(':', 1) for line in parts[1].splitlines() if ':' in line)
    fields = {key.strip(): value.strip() for key, value in fields.items()}
    checks = {
        'native model selection': fields.get('model') == 'opus',
        'calibrated effort': fields.get('effort') == 'medium',
        'file evidence tools only': set(fields.get('tools', '').split(', ')) == {'Read', 'Grep', 'Glob'},
        'explicit mutation denial': set(fields.get('disallowedTools', '').split(', ')) >= {'Bash', 'Write', 'Edit', 'NotebookEdit', 'Agent'},
    }
    for label, ok in checks.items():
        print(('PASS' if ok else 'FAIL') + ': ' + name + ' ' + label)
        if not ok:
            failures.append(name + ': ' + label)
if failures:
    raise SystemExit(1)
print('Configuration checks passed; actual model/effort/permission execution is separate evidence.')
PY
