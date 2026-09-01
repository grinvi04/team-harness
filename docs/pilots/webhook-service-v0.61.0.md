# webhook-service 두 번째 외부 파일럿 — Team Harness v0.61.0

- 측정 시각: 2026-09-01T11:43:49.063Z
- Team Harness: `45514b3d429452d87c058df2776cf34dc71a6ccb`
- 대상: `webhook-service develop@70123c72f4402096ac9c24d07f40320d6a39488a`
- 스택: Python · FastAPI · Alembic
- 측정 원본: [webhook-service-v0.61.0.json](webhook-service-v0.61.0.json)
- simulation 원본: [webhook-service-v0.61.0-simulation.json](webhook-service-v0.61.0-simulation.json)
- 추적: [Team Harness Issue #397](https://github.com/grinvi04/team-harness/issues/397)

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

## 제품 결정

제품 방향 판정은 **연결**이다. Python/Alembic에서도 같은 정본 자산과 repo-sync 결과 계약이 zero-drift로
수렴함을 재현했지만, 이는 임시 clone simulation이지 실제 소비 repo의 병합·required gate 증거가 아니다.
따라서 split package의 `installable:false`와 marketplace 승격 보류를 유지한다.

## 한계와 후속

- 연결 복구 후 GitHub 원본에서 원격 `develop` SHA는 측정 SHA와 일치했다. main·develop branch protection은
  strict·enforce-admins·conversation resolution·force-push/삭제 차단을 유지하고 required context는
  `alembic-heads`, `build-and-test`, `secret-scan` 3개다. `commitlint`와 `destructive-ddl`은 required context에 아직 연결되지 않았다.
- 사용자 clone의 local `develop@20669ab`은 캐시된 `origin/develop@70123c7`보다 한 문서 커밋 뒤였고
  upstream이 없었다. 이를 변경하지 않고 임시 clone에 remote-tracking ref를 복원해 측정했다.
- runner는 앱 dependency 설치·pytest·배포·실제 LLM session·marketplace install을 실행하지 않았다.
- 다음 완료 조건은 실제 webhook-service PR로 세 slice를 적용하고, 기존 보호 불변식을 보존하면서
  `commitlint`와 `destructive-ddl`을 main/develop required context에 연결한 뒤 최종 develop에서
  repo-sync OK 18 · MISSING 0과 앱 품질을 재측정하는 것이다.
