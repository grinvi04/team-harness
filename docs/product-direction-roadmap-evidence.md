# 로드맵 QA·소비 진행 근거

[상위 문서](product-direction.md)로 돌아간다. 아래는 원문의 해당 주제·당시 후보 기록을 순서대로 보존한 본문이다.

공통 QA 계약은 [범위·완료 기준 보강](specs/qa-scope-contract.md),
[근거 조사·평가](specs/qa-strategy-research-plan.md),
[명령별 보고·계약 연결 후속 검증](specs/qa-command-binding-validation.md)까지 완료했다.
행동 평가는 0.79.0 스킬 후보의 제한된 수용 범위에 한정한다. 0.80.0에서는 PR 사전 검사의 큰 문서
오판을 추가 수정했고 [PR #480](https://github.com/grinvi04/team-harness/pull/480)에서 develop 통합 상태를 추적한다.
해당 PR은 develop에 병합됐고 `3c5b4b3` 후보의 0.80.0 릴리즈 사전 검증도 통과했다.
실행 근거·비적용 항목은 같은 후속 문서에 보존한다. [정식 릴리즈 PR #481](https://github.com/grinvi04/team-harness/pull/481)을
main에 병합했고 [v0.80.0 태그](https://github.com/grinvi04/team-harness/tree/v0.80.0)를 발행했다.
솔로 머지 뒤 main의 사람 승인 1명과 기존 보호 정책의 복구를 확인했다. develop 반영 상태는
[역병합 PR #482](https://github.com/grinvi04/team-harness/pull/482) 원본에서 추적한다. 전역 v0.80.0 설치와 새 세션의 제한된 샘플 설치본 검증도 완료했다.
17개 스킬 발견과 명령별 보고·격리 회귀/API unit 검증 근거는 같은 후속 문서에 연결했다.
현재 대화의 skill catalog도 0.80.0 경로로 갱신됐고, 샘플의 정본 전체 로컬 자동 검사도 최초 exit 0으로 통과했다.
실제 API 흐름을 포함한 브라우저 49개와 임시 DB 재시작 보존을 확인했다. axe 색상 대비 incomplete는 2026-10-06에 해당 두 기호의 실제 렌더 색상 24개를 확인해 해소했다.
최소 대비는 5.4466:1이며, 전체 WCAG·모든 브라우저 검증이나 무결함 보장으로 확대하지 않는다.
실행 결과·한계는 같은 후속 문서에 기록하며 설치 이후 기록의 전달·병합 상태는
[기록 통합 PR #483](https://github.com/grinvi04/team-harness/pull/483)을 정본으로 추적한다.
2026-10-06 재조회로 현재 설치·로딩을 확인했으며, 과거 설치 전환/설정 복구의 원문 미보존은 독립 재검증의 한계로 구분한다.
소비 프로젝트별 수정/배포는 후속 작업이며, 제한된 평가는 자동 선택 전반과 제품 전체 품질 보장을 뜻하지 않는다.

2026-10-06 네 소비 repo의 읽기 전용 표준 자산 점검에서 Python `venv` 탐색 중단을 발견했다.
[공통 검사기 보완 명세](specs/repo-sync-python-venv.md)에 재현·회귀와 실제 드리프트를 연결한다.
이 작업은 제품별 QA 실행·표준 반영·배포를 재개하지 않으며, 0.81.0은 아직 소스 후보다.
`7cafd144` 후보의 사전검증은 로컬 품질 63단계·외부 파일럿 live 원본·릴리즈 묶음 검사가 통과했지만,
보안 음성 시험의 판정자 결함 [#486](https://github.com/grinvi04/team-harness/issues/486)으로 **NO-GO**다.
[후보별 결과·한계](specs/repo-sync-python-venv.md#0810-릴리즈-사전검증--no-go)를 보존하고,
2026-10-07 [시험 보완](specs/binary-trust-oracle.md)은 로컬 품질 63단계·실제 macOS unsigned 거부·변이
검출·독립 보안 검토를 통과했다. 전달·최종 CI·병합은 [PR #488](https://github.com/grinvi04/team-harness/pull/488),
최종 사전검증 판정은 [#486](https://github.com/grinvi04/team-harness/issues/486) 원본을 따른다. 과거 NO-GO 기록은 보존한다.
2026-10-07 사전검증 GO 후 [정식 릴리즈 준비](specs/binary-trust-oracle.md#0810-정식-릴리즈-진행)를 시작했다.
main 승인·CI·병합은 [릴리즈 PR #489](https://github.com/grinvi04/team-harness/pull/489)에서 추적한다.
PR #489 main 병합과 필수 승인 요건 1명·전체 보호 원상복구를 확인했고 동일 main SHA에 v0.81.0 태그를 발행했다.
[태그 원본 발행 기록](pilots/release-v0.81.0-publication.json)의 checksum 73/73이 통과했다.
develop 역병합·최종 검토·CI·병합은 [PR #490](https://github.com/grinvi04/team-harness/pull/490) 원본으로 추적한다.
전역 Codex 설치는 0.81.0으로 갱신했고 새 세션에서 스킬 17개 로딩을 확인했다.
[설치·샘플 통합 기록](specs/qa-command-binding-validation.md#0810-전역-설치와-완료-경계-2026-10-07)의
샘플 최초 종료 시험 실패는 보존하고, 사용자 승인 후 로컬 `0c905a0`에서 해당 결함을 수정했다.
새 회귀·전체 QA·독립 검토·문서 검사가 통과해 이 승인 범위의 샘플 통합은 VERIFIED다.
당시 의존성 감사 high 6건 중 후속 샘플 로컬 커밋 `140b6dc`에서 source-map-js 1건을 수정했다.
전체 QA와 독립 검토는 부분 패치 PASS다. 사용자 선택 후 샘플 로컬 `431523d`에서 고정
upstream PR #78의 깊이 보완을 설치 지문 검사와 연결했고, 제품 전체 QA와 동일 기반 독립 회귀
778개가 통과했다. 공식 수정 버전은 없어 전체 감사 high 5건/전체 취약점 제거 FAIL은 유지한다.
[후속 근거](specs/qa-install-v0.81.0-evidence.json)의 dependencySecurityFollowup·bracesMitigationFollowup과
제품 docs/specs/dependency-security.md가 현재 상태·정식 수정판 확인 후 보완 제거 조건을 소유한다.
후속 샘플 `e3f1f47`은 경로 별칭 설치 no-op·stdin import 회귀를 9개 보안 시험과 독립 검토로 보완했다. 기존 앱 QA 재사용과 전체 감사 high 5 잔여는 구분한다. 이는 샘플 전용 보완이며 Harness 공통 패치 기능을 추가하지 않는다. 소비 프로젝트의 최신 승인·적용 상태는 아래 후속 기록과 이슈 #496에서 구분한다.

2026-10-07 사용자 승인으로 [네 소비 프로젝트 적용 준비](pilots/consumer-readiness-2026-10-07.md)를
읽기 전용으로 대조했다. 로컬과 원격 develop 후보를 분리했고, 최신 정본 차이는 ERP 1·siku 3·
webhook-service 1·DriveTree 1이다. 네 프로젝트의 QA 증거/문서 완료 계약 연결, 과거 Proposed
문서 현행화, ERP UAT 목적지 검증과 webhook 게시 분리의 진입 조건을 적용 계획에 남겼다.
앱 QA는 미실행/UNVERIFIED이며 소비 변경·배포 보류를 유지한다. 후속 권고 순서는
DriveTree → webhook-service → siku → erp이며, 첫 소비 변경·격리 실행은 승인 범위를 정한 뒤 진행한다.
후속 범위는 [이슈 #496](https://github.com/grinvi04/team-harness/issues/496), 기록 전달·CI·병합은
[PR #495](https://github.com/grinvi04/team-harness/pull/495) 원본을 따른다.

이후 사용자 진행 승인으로 DriveTree의 QA/문서 계약과 검사 자산 준비·격리 로컬 QA를 수행했다.
로컬 제품 후보 `b5fd437`에서 format/lint/build, backend 단위 70·실DB e2e 17,
frontend 단위 8·Chromium 20(재시도 0)이 PASS다. 실제 HTTP 201/400/413/500 회귀와 검색 출처의
응답/DB 긍정 단언을 보완했고, 빈 검색 반례 검출·복구 후 통합 검사·독립 재검토를 확인했다.
로컬 repo-sync는 새 정본 workflow를 탐지해 18/18 PASS이며 기존 commitlint는 유지한다.
**원격 CI·병합·신뢰 target 검사 활성화·배포는 미실행**이다. npm audit은 backend 운영 의존성
19(critical 1/high 9), frontend 운영 의존성 9(critical 1/high 5)로 exit 1이므로 전체 보안/배포 준비 FAIL을 유지한다.
DriveTree의 `docs/specs/quality-remediation.md`와 실행 근거 JSON이 제품 상태를 소유하며,
자세한 인계와 다음 단계는 [이슈 #496](https://github.com/grinvi04/team-harness/issues/496)에서 추적한다.
이 최초 후보 이후 사용자가 네 소비 프로젝트 모두 진행을 승인했다. DriveTree `36f9b0d`는 회귀
115개와 독립 검토를 통과했고 전체 감사 잔여를 제품 증거에 보존했다. siku `5ad8a96`는 실제
Auth/RLS/Storage 브라우저 25·단위 86·감사 0건과 독립 검토를 확인하고 삭제 거부·부분 실패 처리를 보정했다.
ERP 코드 `dc080bd`·기록 `4d4fbf4`는 실제 curl 우회 반례를 수정하고 격리 Keycloak 초대·재초대,
FE 60+38·Docker·새 전용 DB Java 957개 실제 실행을 검증했다. 최초 DB 잔여 데이터 실패도 보존했다. webhook `5fd2213`는 DB/큐·상속 연결 설정·실패 출력·pytest 시작 전 dotenv 로딩을 보완하고
기존·새 환경 각각 79개와 실제 시작 차단 회귀를 통과했다. 네 로컬 후보의 독립 재검토에서 추가 P1/P2 없음과 증거 지문 일치를 확인했다. 현재 전체 보안/원격 인수는 미완료이며 ERP의 기존 작업은 별도 worktree로 보존했다.
현재 범위·후보·원문·검토 상태는 [진행 기록](pilots/consumer-readiness-2026-10-07.md#후속-네-소비-프로젝트의-로컬-적용-진행)과
이슈 #496에 연결한다. develop 병합의 staging 자동 배포와 main/default 전환·보호 변경은 별도 영향 승인 범위다.
후속 [보안·원격 조건 조사](pilots/consumer-readiness-2026-10-07.md#후속-보안-잔여와-원격-전달-조건-조사)에서 상위 pin·공식 수정판과 Preview 배포 기록을 확인했다. DriveTree `8c5b4f8`은 Swagger 한정 YAML 보완 후 backend 70+19와 독립 검토를 통과했다(frontend 8+20은 이전 증거 재사용). webhook `eba4bfb`은 관리자 로그인 SDK/URL/route·공유 PEM 키·OAuth state와 승인된 admin 역할 제한을 보완하고 기존/새 환경 각각 104개·독립 검토를 통과했다. callback 대역 Redis 시험과 실제 Redis 원자 소비 시험은 구분한다. 이 조사·보완을 현재 보안 또는 원격 인수 완료로 처리하지 않는다. 추가 조회에서 네 repo의 명시 Actions 정책 목록은 0·기본 workflow 권한 read였으나 target 실행은 미실행이다. Railway DriveTree staging의 현재 source는 null, production은 repo 연결만 확인됐으며 최신 과거 배포는 양쪽 FAILED다. 현재 trigger/Wait for CI는 미확인이고 Vercel 설정 조회는 invalid token으로 차단됐다. 사용자는 Vercel 확인을 후속으로 미뤘다. 이 결과로 자동 배포 안전을 확정하거나 provider 설정을 바꾸지 않는다. 이후 DriveTree 코드 `0a654e0`·검토 기록 `76cb019`는 Prisma 버전 유지·내부 의존성 두 개 보완으로 backend 70+19·새 DB migrate 3·운영 감사 0·독립 검토 추가 P1/P2 없음을 확인했다. 전체 개발 도구 감사와 frontend 경고는 남는다. webhook 2.x 호환 pin은 새 경고, 3.9.1은 허용 오차 밖 만료 토큰 수용 P1을 확인해 적용하지 않았다.

작업의 범위·결정·단계가 바뀌면 관련 현재 로드맵·스펙 체크리스트·안내를 같은 변경에서 갱신한다.
검사가 아직 없거나 미실행이면 완료 표시하지 않는다. 적용 절차는 [Markdown 동기화](ai-collaboration.md#markdown-동기화)를 따른다.

열린 [split runtime 이슈 #412](https://github.com/grinvi04/team-harness/issues/412)는 2026-10-06에
CLI 0.156.1과 공식 manifest 문서를 재확인했으나 필요한 cross-plugin dependency/root binding 계약이
확인되지 않아 WAIT를 유지한다. 새 root manifest 권장과 기존 호환 형식 지원을 구분하며,
[최신 capability 기록](pilots/codex-split-runtime-v0.61.0.md#2026-10-06-capability-재확인)에 근거·미실행 범위를 연결한다.
