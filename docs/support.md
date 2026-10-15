# Supported environments

This matrix describes what the repository CI and maintainers actually validate. It is not a claim that every version
of an agent runtime or operating system is compatible.

| Surface | Level | Contract |
|---|---|---|
| GitHub Actions on Ubuntu | **supported** | The full quality and secret-scan gates run on the pinned CI runner. |
| macOS with Bash, Git, and Node.js 20+ | **supported** | Maintainer development, filesystem profiles, and release bundle generation are exercised here. |
| Linux with Bash, Git, and Node.js 20+ | **supported** | Shell and Node contracts run in GitHub Actions; filesystem and permission behavior may differ by distribution. |
| Claude Code adapter source | **supported** (source compatibility) | Committed manifests, hooks, and skills have repository regression coverage. Actual-host execution is **UNVERIFIED / deferred**; no current stable runtime version is certified here. |
| Codex CLI 0.161.0 on macOS arm64 | **supported** (observed surface) | The v1.0.0 acceptance covers isolated official installation, explicit skill loading, and allowed/denied tool-hook execution. Repository tests also cover all 17 wrappers and managed requirements; these are distinct observations. |
| Desktop Codex surface in ChatGPT.app 26.1007.30912 (20156), embedded CodexCLI build1, macOS arm64 | **supported** (observed session) | Actual new-session skill and hook observations are recorded in the R6 evidence below. This does not certify other desktop builds or every automatic skill choice. |
| Other POSIX shells or older runtime versions | **best-effort** | Contributions are welcome, but they are not release gates. |
| Windows without WSL | **unsupported** | The Bash, POSIX permissions, symlink, and atomic rename contracts are not validated. |
| Independent split-package marketplace installation | **unsupported** | Package metadata remains `installable:false` until compatibility validation and explicit publication approval. |

“Supported” means the listed contract is covered by current repository tests. It does not imply vendor support for
Claude Code, Codex, GitHub, Node.js, or Git itself. Report an environment regression with exact versions and the
smallest reproducer; report security-sensitive findings through [`SECURITY.md`](../SECURITY.md).

The exact host/candidate scope and R6 observations are in the [acceptance matrix](specs/team-harness-redesign/architecture.md#이번-재설계의-지원인수-집합)
and [execution record](specs/team-harness-redesign/execution.md). The [delivery record](specs/team-harness-redesign/delivery.md)
links release and installation evidence separately. These results do not transfer automatically to newer host versions.

The optional coordination skill ships no orchestration runtime or npm dependencies. Guidance and skill discovery
do not establish runtime permission enforcement. Historical v0.61.0 evidence remains limited to its original 16-skill artifact.
