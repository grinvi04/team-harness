# Team Harness Quick Start

Team Harness is a GitHub-native governance layer for teams using AI coding agents. It connects local guidance and
guards to server-enforced pull-request, CI, review, and release evidence.

## Prerequisites

- Git and a GitHub repository where you can configure Actions and branch protection
- Bash and Node.js 20 or newer
- macOS or Linux; see the [support matrix](support.md) before production adoption
- Claude Code or Codex only if you want the optional agent adapters

## Verify the checkout

```bash
git clone https://github.com/grinvi04/team-harness.git
cd team-harness
node scripts/build-packages.mjs --check
bash tests/package-build-test.sh
```

The current split packages are staged artifacts, not marketplace products. Their metadata deliberately remains
`installable:false`; do not publish or install them as independent marketplace plugins.

## Try a filesystem profile

Use an empty, disposable directory. This does not change your user plugin cache or global configuration.

```bash
node scripts/manage-profile.mjs install \
  --profile agent-governed \
  --runtime codex \
  --target /tmp/team-harness-profile
node scripts/profile-doctor.mjs --target /tmp/team-harness-profile
```

Available profiles are `repository-only`, `agent-governed`, and `workflow-assisted`. The latter two require a runtime
selection of `claude` or `codex`.

To remove only an optional unit, use `remove --unit <unit-id>`. To remove the managed profile completely:

```bash
node scripts/manage-profile.mjs remove --target /tmp/team-harness-profile --all
```

For a real repository rollout, follow [`onboarding.md`](onboarding.md). Keep branch protection and required CI as the
final enforcement layer; local hooks are defense in depth, not the security boundary.

## Build a release candidate bundle

```bash
node scripts/build-release-bundle.mjs --output /tmp/team-harness-release
(cd /tmp/team-harness-release && shasum -a 256 -c SHA256SUMS)
```

The command uses committed `HEAD`, not dirty working-tree files. It creates evidence for release review; it does not
create a tag, GitHub Release, marketplace entry, or deployment.
