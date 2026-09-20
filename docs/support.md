# Supported environments

This matrix describes what the repository CI and maintainers actually validate. It is not a claim that every version
of an agent runtime or operating system is compatible.

| Surface | Level | Contract |
|---|---|---|
| GitHub Actions on Ubuntu | **supported** | The full quality and secret-scan gates run on the pinned CI runner. |
| macOS with Bash, Git, and Node.js 20+ | **supported** | Maintainer development, filesystem profiles, and release bundle generation are exercised here. |
| Linux with Bash, Git, and Node.js 20+ | **supported** | Shell and Node contracts run in GitHub Actions; filesystem and permission behavior may differ by distribution. |
| Claude Code current stable | **supported** | The committed plugin surface, hooks, skills, and fresh-session contracts are tested. |
| Codex current stable | **supported** | The native plugin loader, managed requirements, command hooks, 17 source skill wrappers, and existing fresh-session contracts are tested. The added coordination skill has local contract/package coverage; its live native activation is not newly measured. |
| Other POSIX shells or older runtime versions | **best-effort** | Contributions are welcome, but they are not release gates. |
| Windows without WSL | **unsupported** | The Bash, POSIX permissions, symlink, and atomic rename contracts are not validated. |
| Independent split-package marketplace installation | **unsupported** | Package metadata remains `installable:false` until compatibility validation and explicit publication approval. |

“Supported” means the listed contract is covered by current repository tests. It does not imply vendor support for
Claude Code, Codex, GitHub, Node.js, or Git itself. Report an environment regression with exact versions and the
smallest reproducer; report security-sensitive findings through [`SECURITY.md`](../SECURITY.md).

The optional orchestration declaration tools require Node.js 22+. Their local tests do not establish runtime permission enforcement or G1. Historical v0.61.0 live-loader evidence remains pinned to its original 16-skill artifact.
