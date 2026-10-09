# Fixed review task

Scope: candidate.py in this folder only. This is a small adapted boundary fixture, not the actual Harness implementation.
Review each contract and identify all violations in the candidate. Include a concrete normal or failure probe for each finding.
Do not modify files, call external services, inspect other model answers, or make implementation changes.
Treat exceptions/statuses conservatively; an unavailable check is not evidence of success.

1. build_checks: if the current protection cannot be fetched, stop by raising before producing any protection update; successful fetches are preserved.
2. restore_equivalent: every protection field must match, including review approvals and bypass allowances, not just CI checks.
3. merge_ready: all current review threads must be resolved, including threads not processed by this run. No threads means ready.
4. migration_verdict: a non-applicable check is SKIP. An applicable nonzero execution is FAIL; zero is PASS.
5. release_target: use the merged PR's exact commit even if main advances afterward; identical commits are also valid.
6. qa_gate: every required row must be PASS. SKIP is acceptable only when applicable is explicitly false. FAIL/UNVERIFIED or unknown applicability for SKIP block completion.
7. audit_record: reject unknown status and SKIP on an applicable check; preserve candidate, command and explicit applicability in returned records.
8. count_unresolved: count every unresolved thread, return zero for an empty list, and do not count resolved threads.

Output one JSON object with findings [{function, lines, violation, probe, expected, observed}], safe_controls [function names], and limitations.
Do not infer that the whole source repository or model configuration is verified by this fixture.
Stop after this bounded review. Do not delegate. Desired maximum response: 900 words.
