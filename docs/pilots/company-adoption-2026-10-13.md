# Representative remote acceptance lab

IN_PROGRESS. See [current contract](../specs/acceptance-policy-wire.md) and
[preserved historical product and assumption evidence](company-adoption-before-remote-lab-2026-10-13.md).

User approved new public synthetic-only grinvi04/team-harness-acceptance-lab.
Existing repos/protections, production, DB/Auth/Storage, secrets and billing excluded.
Published baseline0.93.0/2072511. Compatibility candidate0.93.1 is not published or installed.

Actual bootstrap CI used Actions app15368. Policy GET/preview passed; PUT failed HTTP422
because contexts/checks were sent together. All push/PR checks succeeded, but duplicate
rollup rows falsely blocked merge. First failures and unchanged policies are retained.
Two minimal fixes: exclusive wire representation preserving app bindings; all duplicate
rows must pass and latest current-head/app REST evidence must still agree.

Valid RED reproductions, policy-preservation32, policy/merge28 and wrapper65 GREEN.
Full quality, independent review and remote retest pending. No completion claimed.

Asset lifecycle: actual0.92.1-to0.93.0 changed-byte update, preview no writes, user edit
conflict denial, owned removal and user sentinel preservation PASS_SCOPED.
Deployment probe: independent review caught stale artifact acceptance; current SHA
binding added, stale artifact denied and real HTTP/current artifact/cleanup passed locally.

Representative GitHub policy enforcement/Git Flow/CD and fresh-context handoff run now,
without requiring company employment. Company-specific org rulesets and actual human
approval success, onboarding/learning time/ROI remain separate unmeasured boundaries.
DriveTree historical mandatory UI FAIL is retained; consumer modifications excluded.

Normal main/develop are CI-only from inception. Approval-required probe stays at1.
No company solo or admin bypass. Negative candidates are never delivery approvals.
Disposable deployment is a real runner HTTP server, not cloud staging/production.

Next: independent current-candidate review; remote PUT/readback; denial cases and
normal manual/auto feature, release, hotfix, backmerge, tags/CD; evidence and cleanup.
Raw commands/candidates/exit/run IDs/policies are retained under project-owned
.runtime/company-acceptance-lab-20261013/.
[Public lab](https://github.com/grinvi04/team-harness-acceptance-lab).
