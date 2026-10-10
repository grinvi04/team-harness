# 소비 제품 인수 실행 역사

2026-10-07~08 당시 기록이다. 후보·실패·보류·권한을 현재 상태로 재해석하지 않는다.
[공용 제품 방향](product-direction.md#공통-개발-기반과-선택형-개발-조정)과 함께 읽는다.
[제품별 원문](pilots/consumer-readiness-2026-10-07.md)·이슈가 실제 후속 상태의 정본이며 아래 기록은 기존 방향 문서에서 그대로 이전했다.

원격 전달 전 webhook 로컬 코드 `ef6585a`는 SDK 7.1.1 전환 후 전체 110개·집중 31개·실제 별도 Keycloak/Chrome 로그인·역할 경계 및 전체 runtime/dev graph 감사 0을 확인했다. 독립 검토와 전달 기록은 위 소비 진행 기록을 따른다. 당시 운영 IdP·원격 gate·배포는 미확인이었다. 현재 원격 CI·develop 병합 결과는 아래 후속을 따른다.

DriveTree `907ea04`는 제품 전용 braces 깊이 보완·설치 확인·stdin import 회귀를 보안 10개로 검증했다. unit/build/Chromium의 기존 동일 앱 입력 증거 재사용과 full 감사 high 5는 구분한다. ERP `03a4bad`는 ignore-scripts·미확인 도달성 때문에 보완 미적용 조건과 증거 보존만 기록했다. Harness 공통 패치 기능이나 운영 배포는 추가하지 않았다.

### 소비 원격 인수 후속 (2026-10-07)

webhook은 기존 검증 입력을 보존하고 [develop PR #71](https://github.com/grinvi04/webhook-service/pull/71)의 실제 원격 필수 검사·독립 검토를 통과하고 develop `c4214248`로 병합했다. 보호 설정을 유지했으며 이미지 게시·운영 배포는 하지 않았다. SHA 지문 두 건의 secret-scan 오탐은 정확한 역사상 fingerprint만 식별하고 같은 경로의 합성 token 거부를 확인한다. ERP의 메시지 scope 오류를 고친 `b3fbfb36`은 기존 제품 입력을 유지한다. 사용자가 Vercel 관련 원격 작업 보류를 재확인해 DriveTree·siku와 제공자 preview 연결 미확인 ERP는 로컬 후보를 보존한다. main/default trusted 초기 배치·필수 context 전환·릴리즈·운영 배포는 완료되지 않았다. 실제 인수·정리 결과와 다음 행동은 [준비 기록](pilots/consumer-readiness-2026-10-07.md#후속-소비-원격-전달과-보류-조건-2026-10-07) 및 [이슈 #496](https://github.com/grinvi04/team-harness/issues/496)이 정본이다. 공통 Harness 동작·버전은 바꾸지 않는다.

의존성 후속 재확인에서 DriveTree 운영 감사 0·깊이 보완 10/10, ERP 보완 후보 high 9/7과 공식 수정판 부재를 확인했다. webhook trusted 자산의 로컬 계약 시험은 통과했지만 main 게시 영향 때문에 활성화는 준비 상태다. 현재 경계·완료 한계·복구 순서는 [후속 기록](pilots/consumer-readiness-2026-10-07.md#후속-의존성-재확인과-trusted-전환-준비-2026-10-07)을 따른다.

ERP 후속 `7a13802`는 제품 전용 깊이 보완 코드 `18b18a06`를 로컬 인수했다. ignore-scripts를 유지한 명시 설치 보완, 보안 11·단위 60·브라우저 38·Docker와 CSS/세 화면 동일성을 확인했고 고정 후보 독립 검토에 추가 P1/P2는 없었다. backend 불변의 기존 Java/실 IdP 증거 재사용, 합성 세션 smoke 및 전체 high 9/운영 high 7 FAIL을 구분한다. 공용 Harness 기능·버전은 바꾸지 않았으며 Vercel 원격 보류·trusted 활성화·배포 잔여는 유지한다. 범위와 실패·증거 연결은 [ERP 로컬 인수 기록](pilots/consumer-readiness-2026-10-07.md#후속-erp-깊이-보완의-로컬-인수-2026-10-07)을 따른다.

2026-10-07 당시 사용자가 미리보기 포함 원격 전달을 허용했다. DriveTree [PR #85](https://github.com/grinvi04/drivertree/pull/85) `907ea045`·siku [PR #87](https://github.com/grinvi04/siku/pull/87) `dea9994`·ERP [PR #255](https://github.com/grinvi04/erp/pull/255) `7a13802`는 모두 develop 대상 OPEN이고 현재 head의 필수 CI 6·6·8개가 각각 PASS다. DriveTree의 같은 SHA Vercel Preview는 SUCCESS·GET 200, siku는 배포 SUCCESS지만 비인증 GET 302 보호 화면이어서 앱 확인 UNVERIFIED, ERP는 deployment/status 연결이 없고 Vercel 인증도 없어 Preview UNVERIFIED다. 세 PR의 병합·staging·운영 반영과 감사 잔여 해소는 완료가 아니다. 당시 보류 기록은 위 문단의 시점으로 보존하고 [최신 후보·원격 경계](pilots/consumer-readiness-2026-10-07.md#후속-소비-원격-인수와-webhook-릴리즈-2026-10-07)를 당시 정본으로 삼는다. 현재 병합 상태는 아래 2026-10-08 절을 따른다.

webhook은 [main PR #72](https://github.com/grinvi04/webhook-service/pull/72) 병합 SHA `661ee4f`에 `v1.5.0`을 발행하고 [develop 역병합 PR #73](https://github.com/grinvi04/webhook-service/pull/73)을 마쳤다. main push의 GHCR 게시 job과 action metadata digest는 SUCCESS지만 직접 registry readback은 인증 401/403으로 UNVERIFIED다. [정상 PR #74](https://github.com/grinvi04/webhook-service/pull/74)에서 trusted target 검사가 실제 통과했고 main/develop 보호의 기존 commitlint 요구를 trusted context로 단계적으로 교체·readback했다. [정리 PR #75](https://github.com/grinvi04/webhook-service/pull/75)는 필수 5개·독립 검토를 통과해 develop `e1eee56e`에 병합됐으며 develop legacy workflow를 제거했다. 같은 SHA의 develop push CI는 앱 품질·DB head·비밀 검사 SUCCESS, 이미지 게시 SKIPPED다. main v1.5.0의 역사상 legacy 파일은 다음 정상 릴리즈에서 전파한다. 새 event 정책 예외는 승인·적용하지 않았고 이미지 게시 성공을 운영 배포 완료로 취급하지 않는다. 제품별 전체 보안·인수 상태는 여전히 미완료다.


### develop 병합·외부 기능 관찰 (2026-10-08)

사용자 승인 순서대로 DriveTree PR #85 → siku PR #87 → ERP PR #255를 develop에 병합했다. 필수 CI와 기존 고정 후보 검토를 대조했으며 보호 설정을 유지했다. DriveTree·siku의 merge SHA Preview는 생성됐지만 DriveTree 실제 유지비 계산은 오류로 FAIL, siku 앱 화면은 Vercel 로그인 보호로 UNVERIFIED, ERP 배포 연결도 UNVERIFIED다. 세 제품 main/default trusted 전환·운영 배포는 제외했다. 현재 상태·원문·다음 행동은 [최신 병합·실화면 점검](pilots/consumer-readiness-2026-10-07.md#후속-develop-병합과-실화면점검-2026-10-08)과 [이슈 #496](https://github.com/grinvi04/team-harness/issues/496)을 따른다. 공식 보안 수정판 부재와 전체 감사 잔여, 이전 ERP 컨테이너 런타임의 제한된 패키지 부재를 구분한다. 공통 Harness 동작·버전은 변경하지 않았다.


DriveTree staging 복구 후속 조사에서 실제 소스 연결 null과 Railway 배포 자격 INACTIVE/체험 종료를 확인했다. API health404와 원격 계산 FAIL을 유지하고 결제·계정/인프라/DB·production 변경은 하지 않았다. 계정 활성화 여부·workspace 영향·환경 단독 소스 복원·고정 SHA 기능 검증의 재개 조건은 [staging 진단 후속](pilots/consumer-readiness-2026-10-07.md#staging-복구-진단-후속-2026-10-08)과 제품 PR87·이슈 #496을 따른다. 전체 소비 채택이나 실제 복구 완료로 판정하지 않는다.


2026-10-08 현재 사용자는 DriveTree 추가 결제·Railway 활성화와 별도 테스트 Supabase가 없는 siku 원격 검증을 보류했다. 인증된 siku 미리보기는 Production 전용 Supabase 변수 때문에 실제 앱 기동 FAIL이며, 현재 Vercel 작업 공간 ERP 검색은 결과가 없고 ERP README는 운영 미배포다. 비용 없는 현재 잠금파일 감사와 공식 수정판 재확인에도 보안 판정 변화는 없다. 현재 결정·보류 해제 조건은 [최신 소비 관찰](pilots/consumer-readiness-2026-10-07.md#비용테스트-환경-결정과-인증된-미리보기-관찰-2026-10-08)을 따른다. 이전 활성화 순서는 조건부 계획이며 현재 실행할 다음 단계가 아니다. 새 운영/유료 환경을 만들거나 실패를 반복하지 않는다.

사용자 결정에 따라 이번 배포 제외 인수는 Harness QA 보강과 네 소비 제품의 선정 로컬 QA·develop 필수 CI·독립 검토 적용 검증까지다. 현재 입력·실행 원문·소비 경계의 독립 대조에서 이 범위의 새 차단 결함을 찾지 못해 해당 단계는 완료로 판정한다. 전체 보안 감사 FAIL과 DriveTree·siku·ERP trusted 실제 전환은 남아 있으므로 전체 소비 도입·출시 준비 완료로 판정하지 않는다. 기존 제품별 단계 종료 조건은 유지하며 이슈 #496을 열어 둔다. 현재 완료 범위·증거·재개 조건은 [배포 제외 최종 인수](pilots/consumer-readiness-2026-10-07.md#배포-제외-범위의-최종-인수-2026-10-08)를 따른다. 새 공용 기능·플러그인 버전 변경은 없다.
