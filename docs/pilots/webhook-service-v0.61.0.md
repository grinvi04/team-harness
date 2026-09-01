# webhook-service 두 번째 외부 파일럿 — Team Harness v0.61.0

- 측정 시각: 2026-09-01T11:43:49.063Z
- Team Harness: `45514b3d429452d87c058df2776cf34dc71a6ccb`
- 대상: `webhook-service develop@70123c72f4402096ac9c24d07f40320d6a39488a`
- 스택: Python · FastAPI · Alembic
- 측정 원본: [webhook-service-v0.61.0.json](webhook-service-v0.61.0.json)
- simulation 원본: [webhook-service-v0.61.0-simulation.json](webhook-service-v0.61.0-simulation.json)
- 실제 backfill 재측정: [webhook-service-v0.61.0-remediated.json](webhook-service-v0.61.0-remediated.json)
- 추적: [Team Harness Issue #397](https://github.com/grinvi04/team-harness/issues/397)
- 실제 적용: [webhook-service Issue #68](https://github.com/grinvi04/webhook-service/issues/68) ·
  [webhook-service PR #69](https://github.com/grinvi04/webhook-service/pull/69) ·
  [Team Harness Issue #400](https://github.com/grinvi04/team-harness/issues/400)

## 검증된 결과

격리된 clean clone에서 filesystem profile 설치는 1044.457 ms, doctor는 38.759 ms였고 healthy였다.
repo-sync는 exit 1로 종료했으며 자산 18개 중 OK 5 · WARN 2 · MISSING 11이었다. guard 표본은 허용
4/4와 차단 5/5가 모두 기대값과 일치했고 sample false positive·negative는 각각 0이었다.
측정 전후 HEAD와 porcelain status가 같아 `repositoryUnchanged=true`였다.

MISSING은 다음 세 연결 경계로 분리됐다.

1. stack-rule 전달: Codex pointer 1개. Python·Alembic rule 2개는 repo에 없어 WARN이었다.
2. commit provenance: commitlint workflow·config, executable commit-msg hook, validator 4개.
3. destructive-DDL: workflow·SQL/Alembic/ActiveRecord 검사기와 workflow step 계약 6개.

## zero-drift simulation

실제 소비 저장소를 수정하지 않고 같은 SHA의 임시 clone에 Team Harness 정본을 slice별로 적용했다.
각 단계의 repo-sync 명령·exit code·원시 stdout/stderr·적용 자산 digest는 simulation 원본에 보존했다.
재현 시점의 Team Harness `1118b4b`는 최초 측정 `45514b3`과 repo-sync 및 적용 정본 11개 blob이 모두 같았다.

| 단계 | 적용 | repo-sync |
|---|---|---|
| 기준선 | 변경 없음 | OK 5 · WARN 2 · MISSING 11 |
| slice 1 | stack-rule pointer + Python/Alembic rule | OK 8 · WARN 0 · MISSING 10 |
| slice 2 | commit provenance 정본 4개 | OK 12 · WARN 0 · MISSING 6 |
| slice 3 | destructive-DDL workflow + 검사기 3개 | OK 18 · WARN 0 · MISSING 0 |

마지막 상태에서 SQL과 ActiveRecord 검사는 해당 파일이 없어 정상 skip됐고, Alembic migration 2개는
upgrade 계열의 승인 없는 파괴 DDL 없이 통과했다. 정본 fixture 92개(SQL 24, Alembic 31,
ActiveRecord 37)와 commit message 계약 46개도 모두 통과했다. 실제 webhook-service 저장소와 GitHub 정책은 변경하지 않았다.

## 실제 backfill 완료

simulation의 세 slice를 `fix/harness-v061-backfill`에서 실제 적용했다. 앱·테스트·스키마·Alembic migration은
변경하지 않았고, CI가 무제한 최신 Ruff 0.16.5의 새 Markdown 포맷 동작으로 실패한 사실을 재현한 뒤
검증 버전 0.15.15를 고정해 시간에 따른 품질 결과 드리프트를 제거했다. PR #69의 head
`29f5727ef9b0b7133303e57e6415acc4c522512b`에서 build-and-test, alembic-heads, secret-scan,
commitlint, destructive-ddl, repo-sync, test-guard 7개 check-run과 독립 검토가 모두 통과했다.

공식 merge wrapper로 PR #69를 develop에 병합했고 최종 SHA는
`9743ca849d6d7a746df19e22f74422a7128b90e1`이다. 이 SHA의 격리 clean clone 재측정은 profile 설치
1037.66 ms, doctor 37.404 ms healthy, repo-sync 37.345 ms exit 0으로 **OK 18 · WARN 0 · MISSING 0**이었다.
guard 표본은 9/9 일치했고 `repositoryUnchanged=true`였다.

병합된 develop에서 다음 앱 품질을 다시 확인했다.

- Ruff lint·format 통과, mypy **22 source files** 통과.
- Alembic 단일 head `634bbf55b755` 확인.
- pytest **56 passed**, gitleaks no leaks.
- 원격 develop CI의 build-and-test·alembic-heads·secret-scan도 모두 성공.

GitHub main·develop branch protection은 기존 strict, enforce-admins, conversation resolution,
force-push·삭제 차단, 승인 0을 보존했다. 두 브랜치 모두 `alembic-heads`, `build-and-test`,
`secret-scan`, `commitlint`, `destructive-ddl`의 **required context 5개** exact set으로 연결했고 적용 후
원본 정책을 다시 읽어 확인했다.

## 제품 결정

제품 방향 판정은 **연결**이다. Python/Alembic 소비 repo에서도 같은 정본 자산과 repo-sync 결과 계약이
실제 PR·develop 병합·required gate까지 zero-drift로 수렴했다. 다만 외부 실증은 DriveTree와
webhook-service 두 public repo, 단일 운영자·단일 macOS 환경에 한정되고 실제 marketplace 설치와 새 사용자
session 검증은 아니다. 따라서 두 번째 외부 파일럿은 완료하되 split package의 `installable:false`와
marketplace 승격 보류를 유지한다.

## 한계와 후속

- 최초 측정 당시 GitHub 원본에서 원격 `develop` SHA는 측정 SHA와 일치했다. required context는
  `alembic-heads`, `build-and-test`, `secret-scan` 3개였고 실제 backfill에서 `commitlint`와
  `destructive-ddl`을 추가해 두 브랜치 모두 required context 5개로 연결했다.
- 사용자 clone의 local `develop@20669ab`은 캐시된 `origin/develop@70123c7`보다 한 문서 커밋 뒤였고
  upstream이 없었다. 이를 변경하지 않고 임시 clone에 remote-tracking ref를 복원해 측정했다.
- 재측정 runner 자체는 앱 dependency·pytest·배포·실제 LLM session·marketplace install을 실행하지 않는다.
  앱 lint·type·migration·pytest는 별도 로컬·GitHub CI 증거로 확인했다.
- guard 오탐·누락 0은 명령 문자열 9개 표본에 한정되며 모집단 비율이 아니다.
