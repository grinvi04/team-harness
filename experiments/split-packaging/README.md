# Split packaging experiment

This directory owns the split-package catalog and evaluation implementations. Public installation still uses
one `harness-guard` plugin through [onboarding](../../docs/onboarding.md). Split artifacts remain
`installable: false` and are excluded from public marketplaces.

The catalog version `0.69.0` describes the staged experiment schema and compatibility range; it is independent
of the current monolith release version. Change `packages.json` here once. The old `scripts/` CLI entry points
forward to these implementations, and `scripts/profile-doctor.mjs` preserves its existing exports.

## Evaluate a disposable filesystem profile

Run from the repository root with Bash and Node.js 20 or newer. Use an empty disposable target; this evaluation
does not change user plugin caches or global configuration.

```bash
node experiments/split-packaging/build-packages.mjs --check
bash tests/package-build-test.sh
node experiments/split-packaging/manage-profile.mjs install \
  --profile agent-governed --runtime codex --target /tmp/team-harness-profile
node experiments/split-packaging/profile-doctor.mjs --target /tmp/team-harness-profile
```

Profiles are `repository-only`, `agent-governed`, and `workflow-assisted`. The latter two require `claude` or
`codex`. Remove an optional unit with `remove --unit <unit-id>`. Runtime binding and rollback must pass before
any separate installation claim. These filesystem checks do not authorize a marketplace promotion.

To inspect other unpacked plugins without executing their hooks:

```bash
node scripts/check-plugin-coexistence.mjs \
  --profile /tmp/team-harness-profile --plugins /path/to/external-plugin-directory --json
```

Each direct child of `--plugins` requires matching Claude and Codex manifests. Names are reported as
`plugin:skill`; hook matcher order remains delegated to the platform.

After the evaluation, remove the disposable profile:

```bash
node experiments/split-packaging/manage-profile.mjs remove --target /tmp/team-harness-profile --all
```

## Loader pilots and provenance

`run-codex-native-loader-pilot.mjs` and `run-codex-split-loader-pilot.mjs` are explicit pilot runners, not the
normal installation path. Existing source-revision, executable-trust, fixture-only override and rollback checks
remain in force. Do not run live pilots without their separate authorization. Fixture checks:

```bash
bash tests/codex-native-loader-pilot-test.sh
bash tests/codex-split-loader-pilot-test.sh
```

The release bundle reads the catalog from its pinned Git revision: this directory in current candidates or
`packaging/packages.json` in older revisions. Split pilots use the same distinction in the archived exact source.
No duplicate compatibility catalog is retained. Historical hashes identify the original bytes and paths.
