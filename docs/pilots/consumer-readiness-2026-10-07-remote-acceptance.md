# 소비 원격 보류·trusted 준비·릴리즈 기록

[상위 문서](consumer-readiness-2026-10-07.md)로 돌아간다. 아래는 원문의 해당 주제·당시 후보 기록을 순서대로 보존한 본문이다.

### 후속: 소비 원격 전달과 보류 조건 (2026-10-07)

사용자는 네 소비 프로젝트의 인수와 완료 후 추가 worktree 정리를 요청했다. 앞선 로컬 단계의 실행·한계는 보존한다. Vercel 관련 원격 작업 보류를 다시 확인했으므로 DriveTree·siku는 push/PR을 실행하지 않는다. ERP도 문서의 선택형 Vercel PR preview 연결을 실제로 확인하지 못했으므로 원격 전달은 보류한다. webhook의 develop PR/CI/병합은 이미지 게시·운영 배포와 분리해서 진행한다.

- webhook 전달 후보 `aee5ccf`: 기존 `2d08281`의 앱·시험·의존성·workflow 파일을 유지한 채 미게시 메시지 오류를 해결하고 전달 문서를 연결했다. [PR #71](https://github.com/grinvi04/webhook-service/pull/71)의 최초 후보 `a328e3e`는 기능 품질 등 검사 PASS지만 secret-scan이 QA SHA-256 두 개를 API 키로 오탐하여 FAIL였다. scanner 8.24.3의 원래 range RED 2건·정확한 커밋/파일/규칙/행 fingerprint 두 개만 적용한 GREEN 0건·같은 파일 경로의 새 합성 token 거부 exit 1을 확인했다. workflow·규칙·디렉터리 전체를 제외하지 않았고 고정 후보 독립 보안 검토와 새 원격 CI를 대조한다. 전달 후보 `aee5ccf`에서 필수 원격 CI 5개와 추가 test-guard/repo-sync SUCCESS, 미해결 스레드 0, 독립 검토 추가 P1/P2 없음·동일 보호 설정을 확인하고 래퍼로 PR #71을 develop에 병합했다. 원격 merge SHA는 `c4214248`이며 로컬 develop도 같은 SHA로 fast-forward했다. main/default trusted 활성화·이미지 게시·운영 배포는 완료하지 않았다. 병합 뒤 같은 `c4214248`의 [develop push CI](https://github.com/grinvi04/webhook-service/actions/runs/37570548035)도 build-and-test·alembic-heads·secret-scan SUCCESS, publish-image SKIPPED로 확인했다.
- ERP `b3fbfb36`: `dc080bd`의 scope 누락만 고친 이력 `d72856e`의 전체 tree가 기존 `03a4bad`와 동일하다. 현재 validator range PASS와 스펙 후속 6줄을 독립 검토했다. 기존 Java 957/FE 60/Chromium 38 및 원문 보존은 동일 제품 입력의 증거를 재사용하며 이번 메시지 수정에서 다시 실행했다고 표시하지 않는다. 원래 feature `085d0ce`와 사용자 미추적 작업은 그대로다. high 9 잔여·원격 CI·병합·운영 적용 미확인은 유지한다.
- DriveTree `907ea04`, siku `b6ed228`: 기존 후보와 로컬 QA를 보존하며 Vercel 원격 전달은 보류한다. 새 main/default trusted 초기 배치·event 정책·필수 context 전환은 네 프로젝트 모두 수행하지 않았다. 기존 검사와 보호 설정을 유지한다.

webhook 최초 중간 reword 시도는 역사상 SDK 소스/현재 SDK 환경 불일치와 시험 환경 누락으로 훅 FAIL 후 abort했다. 그 최초 실패는 저장 원문 없이 잘린 도구 관찰만 남아 한계를 명시한다. 최종 전달 commit에서는 명시 주입한 격리 loopback PG/Redis로 Ruff·format·mypy·pytest 훅 전체 PASS를 확인했다. 최초 FAIL을 성공으로 재분류하지 않으며 검사 생략은 하지 않았다.

이번 원격 단계의 실행·실패·반증 원문과 현재 후보/정리 결과는 `$HOME/Documents/Codex/2026-10-07/team-harness-consumer-remote-delivery/`에 보존한다. 이전 `preservation-manifest.json`을 덮어쓰지 않는다. 제품별 QA/다음 행동은 제품 문서와 이슈 #496에서 계속 추적하며, Vercel 보류와 전체 보안·trusted 활성화 잔여 때문에 네 소비 도입 전체는 완료가 아니다.

정리 확인: 이번 ERP 임시 전달 worktree는 clean 상태·현재 fix ref/원래 후보 ref·원문 보존을 확인하고 제거했다. DriveTree·siku의 이미 없는 임시 경로 등록 3개도 refs를 유지하며 정리했다. 네 제품의 기본 checkout은 모두 보존했으며 추가 소비 worktree는 남지 않았다. ERP 기본 feature `085d0ce`와 미추적 `.codex/`는 바꾸지 않았다. 이 정리는 Vercel 보류 후보·감사 잔여·trusted 활성화를 완료 처리하지 않는다. 다음은 보류 해제 후 세 제품 원격 CI/리뷰 인수와 별도 main/default 검사 전환 조건 확인이다.


### 후속: 의존성 재확인과 trusted 전환 준비 (2026-10-07)

이번 범위는 남은 의존성의 현재 보완 가능성 확인, 기존 로컬 보완 재검증과 webhook trusted 전환 준비다. Vercel 원격 보류와 운영 배포 제외는 유지한다. 소비 앱·lock·workflow·보호 설정을 변경하지 않았다.

| 현재 대상 / 선정 이유 | 명령·관찰 경계 | 이번 결과 / 완료 한계 |
|---|---|---|
| DriveTree `907ea045` frontend·backend | 각 cwd에서 `npm audit --json`, `npm audit --json --omit=dev` | frontend 전체 high 5, backend 전체 moderate 20: exit 1/FAIL. 양쪽 운영 그래프 0: exit 0/PASS. 전체 보안 완료는 아님 |
| ERP 보완 후보 `b3fbfb36` frontend | 그 ref의 package.json·lock을 격리 디렉터리에 추출한 lock 감사; 같은 두 audit 명령 | 전체 high 9, 운영 high 7: exit 1/FAIL. 모든 항목이 braces 전이에 연결됨. 설치된 앱·전체 회귀 검사는 이번에 재실행하지 않음 |
| DriveTree 깊이 보완의 정상·거부·무결성 경계 | 실제 frontend에서 `npm run test:dependency-security` | 10/10 PASS·exit 0. 정상 문법/Next ESLint 소비, 깊이·직접 AST 거부, 설치 지문·재적용·변조/새 버전 거부, 개발 의존성 제외·stdin import 확인. npm 경고 해소와 구분 |
| webhook develop `c4214248` trusted 자산 | workflow·validator와 Harness 정본 byte parity; `bash tests/commitlint-trusted-test.sh` | 두 파일 동일, 실제 shell의 정상·잘못된 메시지·head 변경·fetch 실패·metadata·역병합 회귀 PASS/exit 0. 로컬 계약 시험이며 GitHub target 활성화는 UNVERIFIED |

최초 ERP 조회는 원래 작업 브랜치 `085d0ceb`에서 실행돼 전체 31(critical 4/high 19/moderate 8), 운영 26(critical 4/high 17/moderate 5)을 출력했다. 이 결과는 보완 후보의 퇴행이 아니다. 현재 전달 후보의 ref를 직접 읽어 별도 감사한 위 high 9/7과 분리해 보존했다. 첫 보안 시험 호출도 Harness cwd에서 실행해 package.json 부재로 exit 254였으며 파일 변경 없이 실제 DriveTree frontend에서 다시 실행했다. 최초 실패와 후보·cwd·raw 결과는 `$HOME/Documents/Codex/2026-10-07/team-harness-dependency-followup/`에 보존한다.

registry latest는 braces 3.0.3·sprintf-js 1.1.3이며, [braces advisory](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm)와 [sprintf-js advisory](https://github.com/advisories/GHSA-hp3w-g68c-fv3c)의 patched versions는 None이다. 신규 공식 수정판으로 안전하게 교체할 대상은 이번 재확인에서 없었다. DriveTree의 기존 로컬 보완은 유지하고, ERP에 그 패치를 자동 복사하거나 Jest/Next lint를 강제 다운그레이드하지 않았다. ERP CSS/CLI·lint 경계의 별도 보완을 채택하려면 제품 스펙의 클린 설치·시각·BFF·품질 회귀 계약을 먼저 연결한다. sprintf-js는 앞선 소비 경로 조사와 같은 입력이므로 직접 라이브러리 위험과 현재 Jest 경로의 도달성 미확인을 유지한다.

#### webhook trusted 활성화의 실행 조건과 복구

현재 서버의 main/develop은 strict·GitHub Actions app binding을 가진 기존 필수 검사 5개를 유지하며 `commitlint-trusted`를 요구하지 않는다. main workflow 조회는 404, develop에는 파일이 있다. 명시 repository Actions policy 목록은 0이며 상위 정책 부재나 target 실행 가능성을 뜻하지 않는다. main push의 `publish-image`가 활성인 현재 구조에서 기본 브랜치 배치를 이번 준비 작업의 승인으로 실행하지 않는다.

1. 이미지 게시 영향을 포함한 main 릴리즈 승인 범위를 확인하고 기존 보호·이벤트 정책을 보관한다. [공통 전환 계약](../specs/trusted-commitlint.md)을 따르며 별도 우회 workflow를 만들지 않는다.
2. 승인된 기본 브랜치 후보에 workflow·validator를 배치하고 원격 blob/후보를 확인한다. 이 배치 PR의 기존 CI green으로 새 target 실행을 판정하지 않는다.
3. 이후 실제 정상 PR의 고정 head에서 trusted 검사가 실행·성공하고 PR 파일을 실행하지 않았는지 확인한다. target 정책 거부·미실행은 UNVERIFIED이며 정책을 자동 완화하지 않는다.
4. 기존 context를 유지한 채 새 app-bound context를 먼저 추가하고 전체 보호 readback을 대조한 다음에만 기존 요구/legacy workflow를 정리한다. strict·다른 필수 검사·승인·관리자 강제를 보존한다.
5. 실패 시 기존 검사가 실제 실행되는 상태를 먼저 복원한다. 이번 준비에서는 보호·정책·main을 쓰지 않았으므로 서버 복구 변경도 없다. 완료 기준은 기본 브랜치 정본, 후속 실제 target PASS, 보호 readback과 문서 상태의 일치다.

이번 재확인·로컬 계약 검증·전환 준비는 완료했지만 전체 소비 인수·전체 보안·trusted 활성화·배포는 완료되지 않았다. 다음 실행 경계는 공식 수정판 또는 별도 제품 보완 계약, 사용자의 Vercel 보류 해제, webhook 이미지 게시를 포함한 릴리즈 승인이다. 미확인을 완료로 올리지 않는다.

### 후속: ERP 깊이 보완의 로컬 인수 (2026-10-07)

사용자 진행 승인에 따라 ERP 제품 스펙에 필수 범위·기대값을 먼저 연결하고 별도 worktree에서 검증했다. 로컬 후보 `7a13802`의 보완 코드는 `18b18a06`이며 기존 `b3fbfb36` 이후 package-lock·backend 입력은 바꾸지 않았다. 이 보완은 제품 소유 코드이고 Harness 공통 스크립트·스킬·버전은 변경하지 않는다. 앞선 미적용 조사 기록은 당시 후보 결과로 보존한다.

- 상류 braces PR #78의 고정 SHA `97308a01d091b211cf015314a2d0696da28a5392`를 대조했다. 6개 중 5개 patched source는 그대로 같고, parse는 관련 없는 quote/comma 변경을 제외해 설치된 3.0.3의 정상 의미를 유지했다. 정확한 버전·원본/보완 지문을 쓰기 전에 검사하며 새 버전·변조는 거부한다. 100단계 초과 패턴 거부와 확장 수/임의 AST 전체 안전 보장 없음은 명시한다.
- 최초 깊이 시험 4개 중 정상 1 PASS·깊이 3 FAIL → 보완 뒤 설치·무결성·parser/AST·실제 Next rootDir/shadcn fast-glob·stdin import 등 11 PASS다. CI 두 ignore-scripts 설치와 Docker deps 설치 뒤 명시 patch/check를 연결했다. production-only 설치와 이미지 안 보완 지문도 실제 확인했다. Vercel 제공자 설치 설정은 변경하거나 검증하지 않았다.
- 클린 설치 뒤 FE 단위 60·Chromium 38(재시도 0)과 품질·빌드·CLI help PASS, CSS 2개 content와 세 PNG가 baseline과 byte 동일하다. 실제 HTTP BFF는 anonymous null, 합성 암호화 세션의 공개 tenant 응답 및 private token 미노출을 확인한다. 브라우저 시험은 합성 세션·backend 미기동이며 업무/실 IdP UAT 전체로 확대하지 않는다. Java 957/실 Keycloak의 이전 결과는 미변경 backend 입력에만 재사용한다.
- 전체 audit high 9·운영 high 7/exit 1은 계속 FAIL이다. 로컬 패치가 registry metadata를 지우지 않는다. 공식 호환 수정판이 나오면 같은 계약으로 검증하고 보완 제거를 검토한다. Python encoding·upstream parse 비교·shadcn exports fixture·BFF null oracle·validator range 인자 오류의 최초 실패는 그대로 보존하고 수정 이유를 연결했다.
- 원문·cwd·exit·지문과 고정 후보 독립 검토는 제품의 `docs/specs/erp-braces-local-evidence.json` 및 `$HOME/Documents/Codex/2026-10-07/erp-braces-local-adoption/`에 있다. 고정 코드 독립 검토는 추가 P1/P2·필수 로컬 검증 누락 없음으로 판정했다. 제품 스펙·설치 안내·배포 안내·결정 기록을 함께 갱신했다.

ERP 원래 feature `085d0ce`·미추적 사용자 작업은 보존한다. 후보와 원문을 보존한 뒤 소유 임시 worktree를 제거하며 최종 정리·하네스 문서 전달 근거는 [이슈 #496](https://github.com/grinvi04/team-harness/issues/496)에 연결한다. Vercel 관련 원격 전달, 실제 원격 CI·병합, main/default trusted 활성화·이미지 게시·운영 배포는 여전히 미완료다. 이번 로컬 인수를 네 제품 전체 완료로 취급하지 않는다.

### 후속: 소비 원격 인수와 webhook 릴리즈 (2026-10-07)

사용자가 소비 프로젝트의 Vercel 미리보기를 포함한 원격 push·PR·CI를 허용한 뒤 진행한 결과다. 위 Vercel 보류와 원격 미실행은 당시 상태로 보존한다. 세 제품 PR은 develop 대상으로 열려 있으며 병합·staging·운영 배포는 실행하지 않았다. 같은 후보의 GitHub required check와 외부 배포 결과를 별도로 판정한다.

| 제품 | 현재 후보 | 원격 PR·필수 CI | 외부 결과와 남은 경계 |
|---|---|---|---|
| DriveTree | `907ea04529f4ca4bb8b2c003f2eb3a8a886ae551` | [PR #85](https://github.com/grinvi04/drivertree/pull/85) OPEN, develop 대상 필수 6개 PASS | 같은 SHA의 Vercel Preview 배포 SUCCESS, [미리보기](https://drivertree-git-fix-harness-qa-contract-grinvi04-2237s-projects.vercel.app) GET 200. 로컬 전체 감사 frontend high 5·backend moderate 20 FAIL, 운영 그래프 양쪽 0은 별도 기록. 병합·staging/운영 반영 없음 |
| siku | `dea999426959627ebcac169a615905e67cdfdb97` | [PR #87](https://github.com/grinvi04/siku/pull/87) OPEN, 필수 6개 PASS. 최초 `b6ed228`의 repo-sync 정본 줄바꿈 FAIL을 설정 파일 한정 Prettier 폭 90·정본 바이트 적용으로 수정하고 새 head에서 다시 통과 | 같은 SHA의 Vercel Preview SUCCESS. [미리보기](https://siku-git-fix-harness-qa-contract-grinvi04-2237s-projects.vercel.app)는 비인증 GET 302로 Vercel 로그인에 이동하므로 앱 화면은 UNVERIFIED. 운영 DB drift 미측정·DB/Storage 삭제 비원자성 유지 |
| ERP | `7a13802ce712edb93240933bcd7841b629b42574` | [PR #255](https://github.com/grinvi04/erp/pull/255) OPEN, 필수 8개 PASS. 로컬 소스 10·원문 72개 지문 일치 | 이 SHA의 GitHub deployment·외부 commit status·Vercel PR 댓글 0건. CLI 인증이 없어 로그인 흐름을 중단했고 preview URL·실화면은 UNVERIFIED. 전체 감사 high 9·운영 high 7 FAIL; 실 Keycloak·업무 API 원격 UAT 미실행 |
| webhook-service | `e1eee56e101be3fc61526430599773116cd95797` | [정리 PR #75](https://github.com/grinvi04/webhook-service/pull/75) MERGED, head `84648232` 필수 5개 PASS·독립 검토 추가 P1/P2 없음. 앞선 main 릴리즈와 역병합·trusted 정상 PR은 아래 원본으로 구분 | main `661ee4f`/`v1.5.0` GHCR 게시 job SUCCESS, 직접 registry pull UNVERIFIED. main/develop 보호의 필수 context는 trusted로 전환됐지만 main의 역사상 legacy workflow 파일은 남음; 운영 배포 증거 없음 |

siku의 과거 QA 입력 101개 중 새 후보에서 `commitlint.config.cjs` 하나만 바뀌었고, 새 설정의 정본·형식·lint·repo-sync와 원격 필수 CI는 통과했다. 기존 앱 QA는 입력 불변 범위에만 재사용한다. ERP의 원래 feature `085d0ce`와 미추적 `.codex/`는 보존했고 이 원격 작업의 추가 소비 worktree는 0개다. 세 제품의 원문·초기 실패·현재 PR/배포 판정은 각 제품 스펙과 `$HOME/Documents/Codex/2026-10-07/siku-erp-remote-adoption/` 및 DriveTree 원격 인수 기록에 연결한다.

webhook-service는 [main PR #72](https://github.com/grinvi04/webhook-service/pull/72)를 병합해 main `661ee4fda9a78002383eeb38e0d7e49c1cbd0e59`에 `v1.5.0` 태그를 발행하고 [develop 역병합 PR #73](https://github.com/grinvi04/webhook-service/pull/73)도 병합했다. main push의 GHCR 이미지 게시 job은 SUCCESS이며 action metadata에 digest `sha256:79c2df3f934428cf7ac8a1a6f741cde7833d165b24636e27061a4f84785c4124`가 기록됐다. 익명 registry 조회 401·현재 PAT 패키지 조회 403이므로 직접 manifest pull/readback은 UNVERIFIED다. 이미지 게시 성공을 운영 서비스 배포나 registry 직접 검증으로 확대하지 않는다.

같은 제품의 [정상 PR #74](https://github.com/grinvi04/webhook-service/pull/74) 고정 head `2ae5c20fa1aedcf2d2e85d6c370f0d003da7aafa`에서 `commitlint-trusted`가 실제 SUCCESS였다. main/develop의 필수 5개는 기존 `commitlint`를 유지한 채 trusted를 먼저 추가·readback하고 이후 기존 요구만 제거·readback했다. 현재 양쪽 보호 목록은 `alembic-heads`, `build-and-test`, `secret-scan`, `destructive-ddl`, `commitlint-trusted`이며 strict·GitHub Actions app binding을 유지한다. [legacy 정리 PR #75](https://github.com/grinvi04/webhook-service/pull/75)의 고정 head `84648232d3d08c22b8c94296a4c03bd9bbd3769a`는 필수 5개 PASS·독립 읽기 전용 검토 추가 P1/P2 없음으로 develop `e1eee56e101be3fc61526430599773116cd95797`에 병합됐다. 같은 SHA의 [develop push CI](https://github.com/grinvi04/webhook-service/actions/runs/37623796575)에서도 build-and-test·alembic-heads·secret-scan SUCCESS, publish-image SKIPPED다. develop의 기존 `commitlint.yml`은 제거됐고 main v1.5.0에는 역사상 파일이 남아 다음 정상 릴리즈 전파를 기다린다. 현재 main의 trusted workflow 파일은 존재한다. 새로운 target 이벤트 정책 예외는 승인·적용하지 않았다.

현재 세 제품의 PR 병합·실서비스 반영, ERP preview와 siku 앱 화면, webhook registry 직접 readback, 각 제품의 잔여 전체 감사와 운영 인수는 완료가 아니다.

다음 단계는 PR별 리뷰·병합 영향과 미확인 provider/보안 경계를 해당 제품 원본에서 따로 판정하는 것이다. webhook main의 legacy 파일 전파도 다음 정상 릴리즈에서 분리해 확인한다. 이 문서 갱신 자체는 소비 제품 코드나 보호 정책을 변경하지 않는다.
