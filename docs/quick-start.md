# Team Harness Quick Start

Team Harness helps a developer reuse technical conventions, setup, and checks across frontend, backend, database,
and infrastructure work, then share useful practices with colleagues. GitHub is optional. For GitHub projects,
Harness also connects local guidance and guards to pull-request, CI, review, and release evidence.

## Prerequisites

- Git, Bash, and Node.js 20 or newer on macOS or Linux; check the [support matrix](support.md)
- Claude Code or Codex for the optional agent adapters; Codex configuration checks also require Python 3.11 or newer
- GitHub repository access and authenticated `gh` only when you choose GitHub PRs, CI, or branch protection

## Install and verify

Follow the [official installation and verification guide](harness-setup.md) for the public `harness-guard` plugin.
It covers the supported Claude Code and Codex plugin commands, checking the installed version, connecting a product
repository, and diagnosing the components you actually selected. Installation checks and actual hook enforcement
are separate evidence; follow that guide's boundaries for optional runtime probes.

For new repository setup, follow [onboarding](onboarding.md). For an existing product, use
[selective onboarding](guides/existing-repository.md) and preserve its files, hooks, checks, and branch policy.
Local development does not require creating or publishing a remote repository. Prepared supported apps can use
the [single-stack local check setup](local-development.md); application generation and test-tool setup belong to the product.

## Start real work in the product repository

Open the product repository, then follow the existing guides:

- Working alone: [first readiness check and real task request](guides/solo-development.md#처음-연결할-때).
  Reuse the product's conventions, checks, and adopted main or Git Flow policy.
- Working in a small team: [shared setup and task ownership](guides/team-development.md#처음-함께-사용할-때).
  Connect shared acceptance criteria, individual changes, independent review, and integration checks.

Use natural-language requests; skill commands are optional. Use one development methodology, such as installed
Superpowers, for design, TDD, and debugging. Harness connects project standards, checks, handoffs, and delivery
gates without repeating that workflow. Native execution remains available without installing another methodology.
The guides own the request examples and completion criteria; implementation, merge, release, installation, and
deployment are distinct outcomes. Preserve existing required CI, review, and branch protection when using GitHub.

## Maintenance and experiments

Contributor release preparation belongs in [Harness maintenance](harness-maintenance.md).
Split packages, disposable profiles, loader pilots, and bundle evaluation belong in the
[packaging experiment](../experiments/split-packaging/README.md); they are not the public installation or first-task path.
