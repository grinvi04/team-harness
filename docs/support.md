# Supported environments

This matrix describes what the repository CI and maintainers actually validate. It is not a claim that every version
of an agent runtime or operating system is compatible.

| Surface | Level | Contract |
|---|---|---|
| GitHub Actions on Ubuntu | **supported** | The full quality and secret-scan gates run on the pinned CI runner. |
| macOS with Bash, Git, and Node.js 20+ | **supported** | Maintainer development, filesystem profiles, and release bundle generation are exercised here. |
| Linux with Bash, Git, and Node.js 20+ | **supported** | Shell and Node contracts run in GitHub Actions; filesystem and permission behavior may differ by distribution. |
| Claude Code current stable | **supported** | The committed plugin surface, hooks, skills, and fresh-session contracts are tested. |
| Codex current stable | **supported** | The native plugin loader, managed requirements, command hooks, 16 skill wrappers, and fresh-session contracts are tested. |
| Other POSIX shells or older runtime versions | **best-effort** | Contributions are welcome, but they are not release gates. |
| Windows without WSL | **unsupported** | The Bash, POSIX permissions, symlink, and atomic rename contracts are not validated. |
| Independent split-package marketplace installation | **unsupported** | Package metadata remains `installable:false` until compatibility validation and explicit publication approval. |

“Supported” means the listed contract is covered by current repository tests. It does not imply vendor support for
Claude Code, Codex, GitHub, Node.js, or Git itself. Report an environment regression with exact versions and the
smallest reproducer; report security-sensitive findings through [`SECURITY.md`](../SECURITY.md).
