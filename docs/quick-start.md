# Team Harness Quick Start

Team Harness helps a developer reuse technical conventions, setup, and checks across frontend, backend, database,
and infrastructure work, then share useful practices with colleagues. For GitHub projects, it also connects local
guidance and guards to server-enforced pull-request, CI, review, and release evidence.

For local development, start with the [development guide](development-coordination.md) and the product's existing
checks; a remote repository is not required. The instructions below cover GitHub rollout and package evaluation.
Prepared Spring Boot+Vue projects can use the [local check setup](local-development.md) to preview and add a
portable check entry point without overwriting existing files. Application generation and configuring the
underlying test tools remain product responsibilities; broader reuse follows the [product roadmap](product-direction.md).

Use natural-language requests; skill commands are optional. Use one development methodology (such as installed
Superpowers) for design, TDD, and debugging. Harness connects project standards, checks, handoffs, and delivery
gates without repeating that workflow. Native execution remains available without installing another methodology.

## Prerequisites

- Git and a GitHub repository where you can configure Actions and branch protection
- Bash and Node.js 20 or newer
- macOS or Linux; see the [support matrix](support.md) before production adoption
- Claude Code or Codex only if you want the optional agent adapters

## Install and verify

Follow [onboarding](onboarding.md) for the current public `harness-guard` plugin installation and its checks.
Keep branch protection and required CI as the final enforcement layer.

Split packages, `profile-doctor.mjs`, and disposable filesystem profiles are an optional [packaging experiment](../experiments/split-packaging/README.md).
They remain `installable: false` and are not public marketplace products. Their staged version is independent
of the current monolith release.

## Build a release candidate bundle

```bash
node scripts/build-release-bundle.mjs --output /tmp/team-harness-release
(cd /tmp/team-harness-release && shasum -a 256 -c SHA256SUMS)
```

The command uses committed `HEAD`, not dirty working-tree files. It creates evidence for release review; it does not
create a tag, GitHub Release, marketplace entry, or deployment.

## Optional development coordination

Selected handoff and resume practices from Agent Orchestration are available through `ao-coordinate` in Team Harness. Follow [the development guide](development-coordination.md) to connect a product request, ownership, handoff, verification, and acceptance to the existing core gates. Simple tasks stay with one agent. No orchestration npm package, JSON contracts, or record generator is required or shipped. No separate role-profile installer is added. Historical runtime experiments are not bundled.
