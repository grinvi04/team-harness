#!/usr/bin/env bash
# Selected coordination guidance must ship without the retired AO toolchain.
set -euo pipefail
ROOT=$(cd "$(dirname "$0")/.." && pwd)
python3 - "$ROOT" <<'CHECK'
import json, re, subprocess, sys, tempfile
from pathlib import Path
root = Path(sys.argv[1])
plugin = root / 'plugins/harness-guard'
assert not (plugin / 'tools/orchestration').exists(), 'retired AO toolchain is still shipped'
catalog = json.loads((root / 'packaging/packages.json').read_text())
units = {p['id']: p for p in catalog['packages']}
assert 'skills/ao-coordinate' in units['workflow-pack']['sources']
assert all('orchestration' not in s for p in units.values() for s in p['sources'])
assert 'skills/ao-coordinate' not in units['governance-core']['sources']
print('PASS: optional workflow boundary, no retired toolchain dependency')
with tempfile.TemporaryDirectory(prefix='harness-coordination-') as temp:
    built = Path(temp) / 'packages'
    subprocess.run(['node', str(root / 'scripts/build-packages.mjs'), '--output', str(built)], check=True, stdout=subprocess.DEVNULL)
    workflow = built / 'harness-workflows'
    skill = workflow / 'skills/ao-coordinate/SKILL.md'
    assert skill.is_file(), 'coordination entry missing from built workflow'
    assert not (workflow / 'tools/orchestration').exists(), 'retired toolchain in artifact'
    for target in re.findall(r'\[[^\]]+\]\(([^)]+)\)', skill.read_text()):
        if target.startswith(('https://', 'http://', '#')):
            continue
        path = (skill.parent / target.split('#')[0]).resolve()
        assert path.is_relative_to(workflow.resolve()), f'out-of-package reference: {target}'
        assert path.is_file(), f'missing packaged reference: {target}'
    assert not (built / 'harness-governance-core/skills/ao-coordinate').exists()
print('PASS: built workflow has usable references and core remains independent')
CHECK
