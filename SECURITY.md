# Security Policy

## Supported versions

Security fixes are provided for the latest published `v0.x` release. The `develop` branch is pre-release work and may
contain unreleased changes; older tags receive fixes only when a maintainer explicitly announces an exception.

## Reporting a vulnerability

Report vulnerabilities privately through GitHub Security Advisories for this repository (“Report a vulnerability”).
Do not open a public issue or pull request before maintainers have coordinated disclosure. If private reporting is not
available, open a minimal issue that asks for a private contact channel without vulnerability details.

Include the affected tag or commit, runtime and OS versions, impact, prerequisites, and a minimal reproducer. Remove
real secrets, tokens, credentials, personal paths, customer data, and production logs; use synthetic placeholders.

Maintainers aim to acknowledge a report within 3 business days and provide a triage decision within 7 business days.
These are response targets, not a remediation guarantee. We will coordinate validation, a fix, release timing, and
credit with the reporter before public disclosure.

Local hooks are defense in depth. Findings that bypass GitHub branch protection, required CI, provenance checks, or
release gates are especially important even when a prompt or local hook also blocks the same action.
