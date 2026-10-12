# 과거 실행 자료의 고정 원문

현재 정책은 [결정 목록](decisions.md)과 각 주제 정본에서 읽는다. 아래는 삭제·축약 전
바이트의 위치와 SHA-256이다. 과거 후보의 PASS·실패·보류를 현재 상태로 다시 판정하지 않는다.
시작 후보 `54657b3ef79ab36c3e0877664964356badd3510b`의 blob과 checkout 바이트를 대조한 뒤 옮겼다.

## 원문 읽기와 복구

GitHub 링크는 전체 커밋 SHA로 고정한다. 전체 Git 이력이 있는 checkout에서 파일을 복구한다.

```bash
git --no-replace-objects show \
  54657b3ef79ab36c3e0877664964356badd3510b:<아래 경로> > /tmp/harness-history-original
shasum -a 256 /tmp/harness-history-original
```

역사 검사의 `tests/lib/read-history-blob.mjs`는 전체 SHA·정규화한 repo 경로·아래 digest를
검증하고 stdout으로 바이트를 반환한다. Git 원문 누락·digest 누락/불일치는 실패이며
working tree로 대체하지 않는다. 현재 checkout의 필수 검사와 역사 원문 판정은 구분한다.

## 원문 목록

| 원문 경로 | SHA-256 |
|---|---|
| [docs/decisions-foundation-and-hardening.md](https://github.com/grinvi04/team-harness/blob/54657b3ef79ab36c3e0877664964356badd3510b/docs/decisions-foundation-and-hardening.md) | `fbfe7fbd3da8e228b01387b0de2c7497fb17b244a33cebc3773ab079243838f0` |
| [docs/decisions-native-and-delivery.md](https://github.com/grinvi04/team-harness/blob/54657b3ef79ab36c3e0877664964356badd3510b/docs/decisions-native-and-delivery.md) | `46e60e1c5f507e5b1d89c85c8906f840f81dd28c919a34f39b2542e50b654d5f` |
| [docs/pilots/binary-trust-oracle-2026-10-07.json](https://github.com/grinvi04/team-harness/blob/54657b3ef79ab36c3e0877664964356badd3510b/docs/pilots/binary-trust-oracle-2026-10-07.json) | `fcc8baccb71b64cea2a4c48a2a855c06518789a969dfc4f126686fdcb345fa57` |
| [docs/pilots/codex-native-loader-v0.61.0.guard.txt](https://github.com/grinvi04/team-harness/blob/54657b3ef79ab36c3e0877664964356badd3510b/docs/pilots/codex-native-loader-v0.61.0.guard.txt) | `39c3d6d47f39d11e6ebce4833bd592048654cbc6640b9f34ebb85de8a78a7b5a` |
| [docs/pilots/codex-native-loader-v0.61.0.json](https://github.com/grinvi04/team-harness/blob/54657b3ef79ab36c3e0877664964356badd3510b/docs/pilots/codex-native-loader-v0.61.0.json) | `bcb2455883567fff9dc9f2e23e0c30c8b9aceb5e0386e712869b08b1c6714e43` |
| [docs/pilots/codex-native-loader-v0.61.0.md](https://github.com/grinvi04/team-harness/blob/54657b3ef79ab36c3e0877664964356badd3510b/docs/pilots/codex-native-loader-v0.61.0.md) | `ee9f7c33f3f7349dc8f10b312de83a03d8055b6790767623e0e473f479f1ea6e` |
| [docs/pilots/codex-native-loader-v0.61.0.routing.jsonl](https://github.com/grinvi04/team-harness/blob/54657b3ef79ab36c3e0877664964356badd3510b/docs/pilots/codex-native-loader-v0.61.0.routing.jsonl) | `e655e1d59420020aafe6f0384f4a7cbc03909744484484d62ad2181641513636` |
| [docs/pilots/codex-split-loader-v0.61.0.json](https://github.com/grinvi04/team-harness/blob/54657b3ef79ab36c3e0877664964356badd3510b/docs/pilots/codex-split-loader-v0.61.0.json) | `4a28fe68d0860f85dc3c356ca0b36d098a3caa498cc0407b2374f26e5c711719` |
| [docs/pilots/codex-split-loader-v0.61.0.md](https://github.com/grinvi04/team-harness/blob/54657b3ef79ab36c3e0877664964356badd3510b/docs/pilots/codex-split-loader-v0.61.0.md) | `fe950100367405a57dfd82bc627740e67c948827f36787e8a22a4e903cdf6b59` |
| [docs/pilots/codex-split-runtime-v0.61.0.json](https://github.com/grinvi04/team-harness/blob/54657b3ef79ab36c3e0877664964356badd3510b/docs/pilots/codex-split-runtime-v0.61.0.json) | `2db6f9ee87df527ce4ff1e27623a1fafbfb5e473b4e19c0b138c9d354b933e75` |
| [docs/pilots/codex-split-runtime-v0.61.0.md](https://github.com/grinvi04/team-harness/blob/54657b3ef79ab36c3e0877664964356badd3510b/docs/pilots/codex-split-runtime-v0.61.0.md) | `b111e7f89e11055cdc772ad461fee986a97dedb3e4b4eca2965bc3afda222731` |
| [docs/pilots/consumer-repo-sync-2026-10-06.json](https://github.com/grinvi04/team-harness/blob/54657b3ef79ab36c3e0877664964356badd3510b/docs/pilots/consumer-repo-sync-2026-10-06.json) | `c20d468696d2674b70001a0110aff76b61c8c751a8c0de9a90c26daec7cc7018` |
| [docs/pilots/drivertree-v0.60.0.md](https://github.com/grinvi04/team-harness/blob/54657b3ef79ab36c3e0877664964356badd3510b/docs/pilots/drivertree-v0.60.0.md) | `f16996f9e0e79c0804a5865e4428e2dcec5ccda6e8c1ce4c50dc38231eabc711` |
| [docs/pilots/drivertree-v0.61.0.md](https://github.com/grinvi04/team-harness/blob/54657b3ef79ab36c3e0877664964356badd3510b/docs/pilots/drivertree-v0.61.0.md) | `0136a3310d7484df20611ec7538d5063feb63d8df7f7b1caefe013d55b58fc19` |
| [docs/pilots/release-v0.81.0-check.json](https://github.com/grinvi04/team-harness/blob/54657b3ef79ab36c3e0877664964356badd3510b/docs/pilots/release-v0.81.0-check.json) | `a9d5a2ebdd4b352d21630bd35e998fcac423ef463f342ad5c996c24be19cba91` |
| [docs/pilots/release-v0.81.0-publication.json](https://github.com/grinvi04/team-harness/blob/54657b3ef79ab36c3e0877664964356badd3510b/docs/pilots/release-v0.81.0-publication.json) | `897f3d8d587b1059e7317714daa1a96a79a7f7148c091f6a1e76428dae811ea2` |
| [docs/pilots/webhook-service-v0.61.0.md](https://github.com/grinvi04/team-harness/blob/54657b3ef79ab36c3e0877664964356badd3510b/docs/pilots/webhook-service-v0.61.0.md) | `b2354655c283fa34557be55e3c02789483a87483f56751bf7e15cc43b64a7d58` |
| [docs/specs/multi-project-integration-evidence.json](https://github.com/grinvi04/team-harness/blob/54657b3ef79ab36c3e0877664964356badd3510b/docs/specs/multi-project-integration-evidence.json) | `2e0515ee3fd103592240d8063f976ca7fb7a4334bb56dff53842bb4e19585e1f` |
| [docs/specs/multi-project-qa-evidence.json](https://github.com/grinvi04/team-harness/blob/54657b3ef79ab36c3e0877664964356badd3510b/docs/specs/multi-project-qa-evidence.json) | `b0050d04af2d937ce05503837b44ed238f4e6cc0fe870ac3a2327aabd509cbf6` |
| [docs/specs/qa-behavior-evidence.json](https://github.com/grinvi04/team-harness/blob/54657b3ef79ab36c3e0877664964356badd3510b/docs/specs/qa-behavior-evidence.json) | `952af88650babd577e0949f8e91e63811be1a6d8c837801d5a2e65e53cf4318d` |
| [docs/specs/qa-command-binding-evidence.json](https://github.com/grinvi04/team-harness/blob/54657b3ef79ab36c3e0877664964356badd3510b/docs/specs/qa-command-binding-evidence.json) | `b65a9a90d477aa1bb595083edd32cd90993ce66d1df2ae2e08212ee66b097a35` |
| [docs/specs/qa-install-v0.80.0-evidence.json](https://github.com/grinvi04/team-harness/blob/54657b3ef79ab36c3e0877664964356badd3510b/docs/specs/qa-install-v0.80.0-evidence.json) | `c1499d705c52ca57c5c60bf2bc51587d3df897779a42d5987e45f4bf5229f64f` |
| [docs/specs/qa-install-v0.81.0-evidence.json](https://github.com/grinvi04/team-harness/blob/54657b3ef79ab36c3e0877664964356badd3510b/docs/specs/qa-install-v0.81.0-evidence.json) | `7729b66bb122a26b71b655e41c36d617d9be90fcef920918e7926073b4b27006` |
| [docs/specs/qa-practical-evidence.json](https://github.com/grinvi04/team-harness/blob/54657b3ef79ab36c3e0877664964356badd3510b/docs/specs/qa-practical-evidence.json) | `0143f5fd1d1b51cdd7c182a590bdd8603c1353a248bce6ff041357d5b78759cd` |
| [docs/specs/standards-refresh/links.json](https://github.com/grinvi04/team-harness/blob/54657b3ef79ab36c3e0877664964356badd3510b/docs/specs/standards-refresh/links.json) | `1b5e69cd58819ed84f19788a1e586bcee70709244e8ce33e2089daad7c0865be` |
| [docs/specs/standards-refresh/merge-review-followup.md](https://github.com/grinvi04/team-harness/blob/54657b3ef79ab36c3e0877664964356badd3510b/docs/specs/standards-refresh/merge-review-followup.md) | `1012c7b244b79a275c51f65daeb27e7aa98040f93cbfc069a46591d463013052` |
| [docs/specs/standards-refresh/merge-review-initial.md](https://github.com/grinvi04/team-harness/blob/54657b3ef79ab36c3e0877664964356badd3510b/docs/specs/standards-refresh/merge-review-initial.md) | `dcb70099be3902b8ef2049756fbd87117f2df78684075d35564b426c68ae3117` |
| [docs/specs/standards-refresh/quality.log.gz](https://github.com/grinvi04/team-harness/blob/54657b3ef79ab36c3e0877664964356badd3510b/docs/specs/standards-refresh/quality.log.gz) | `07361a836d6f5c5d528d79751be4582003fd04d0da42b7785f4d0ba5522d130b` |
| [docs/specs/standards-refresh/results.json](https://github.com/grinvi04/team-harness/blob/54657b3ef79ab36c3e0877664964356badd3510b/docs/specs/standards-refresh/results.json) | `7bff140c94070e59d67febc67b75ddd7b2b255995d868c6e28d9330cc5c5ab5d` |
| [docs/specs/standards-refresh/review-followup.md](https://github.com/grinvi04/team-harness/blob/54657b3ef79ab36c3e0877664964356badd3510b/docs/specs/standards-refresh/review-followup.md) | `314893f7fd4f4f911be9d8e0eb74f61f00bdc6b100573d667dd35099bd3aa76d` |
| [docs/specs/standards-refresh/review-initial.md](https://github.com/grinvi04/team-harness/blob/54657b3ef79ab36c3e0877664964356badd3510b/docs/specs/standards-refresh/review-initial.md) | `558f62fed56dbf44cac5933bc4708f4ff288d04b0c9333093f1b5ee79f9cbdcc` |
| [docs/specs/standards-refresh/source.sha256](https://github.com/grinvi04/team-harness/blob/54657b3ef79ab36c3e0877664964356badd3510b/docs/specs/standards-refresh/source.sha256) | `cfd0439971547e643994ea0ea3048b584a8e97ab2b56cf861a8c7787ad71862e` |

## checkout에 유지하는 필수 자료

`docs/pilots/codex-native-loader-trusted-binaries.json`과
`docs/pilots/external-pilot-provenance.json`은 현재 검증의 정본이며 변경하지 않았다.
provenance verifier는 manifest의 아래 7개 현재 파일을 읽고 digest를 재계산하므로 그대로 유지한다.

- `docs/pilots/drivertree-v0.60.0.json`
- `docs/pilots/drivertree-v0.61.0-before.json`
- `docs/pilots/drivertree-v0.61.0-after.json`
- `docs/pilots/drivertree-v0.61.0-remediated.json`
- `docs/pilots/webhook-service-v0.61.0.json`
- `docs/pilots/webhook-service-v0.61.0-simulation.json`
- `docs/pilots/webhook-service-v0.61.0-remediated.json`

`consumer-readiness-2026-10-07*`는 현재 소비 인수 FAIL·미전환·배포 보류와 재개 조건을
읽는 자료이므로 유지한다. 본문 판정은 보존하고 옮긴 증거 링크만 고정 Git으로 연결한다.
changelog·시험 fixture와 현재 trust/provenance의 실패 시 차단을 유지한다.
