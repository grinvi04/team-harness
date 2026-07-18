# Contributing to Team Harness

Start with [`AGENTS.md`](AGENTS.md), which is the repository's working contract, and
[`docs/product-direction.md`](docs/product-direction.md), which defines the product boundary.

1. Base work on `develop` and use a `feature/*` or `fix/*` branch. Never commit or push directly to `main` or `develop`.
2. For non-trivial features, add an approved spec under `docs/specs/` before implementation.
3. Add a failing contract first, make the smallest implementation pass, and run the affected tests plus the complete
   `.github/workflows/ci-gate.yml` quality sequence.
4. Use Conventional Commits in the Korean repository format documented in [`docs/code-review.md`](docs/code-review.md).
   Semantic `feat`, `fix`, `refactor`, and `perf` commits require an `이유:` body.
5. Create the pull request through `plugins/harness-guard/scripts/pr-create.sh`; do not invoke bare `gh pr create`.
   PRs target `develop` unless the documented hotfix or release flow says otherwise.
6. Resolve review threads and required checks, then merge only through the repository's harness workflow.

Keep changes surgical. Do not weaken secret scanning, guards, or server gates to make a test pass. Changes affecting
plugin, hook, skill, script, or template behavior must follow the version policy in
[`docs/harness-maintenance.md`](docs/harness-maintenance.md).

Security reports do not belong in public pull requests. Follow [`SECURITY.md`](SECURITY.md).
