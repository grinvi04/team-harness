# Historical execution evidence

[Harness modernization](harness-modernization/) preserves the original plans, reviews, commands, outputs and
candidate metadata from the completed modernization work. Its current entry point is
[the modernization spec](../specs/harness-modernization.md); current installation follows
[onboarding](../onboarding.md).

Files moved from `docs/specs/harness-modernization/` retain their bytes and blob hashes. Embedded original
paths, candidate SHAs, absolute paths and historical relative links describe the recorded execution; they are
not rewritten as current commands or candidates. Read such paths against the recorded revision. Current
direct readers and links point to this archive. Historical PASS does not validate a later candidate.
