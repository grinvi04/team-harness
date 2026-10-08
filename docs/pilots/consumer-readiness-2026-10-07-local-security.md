# 소비 로컬 QA·보안 비교의 초기 후보 기록

[상위 문서](consumer-readiness-2026-10-07.md)로 돌아간다. 아래는 원문의 해당 주제·당시 후보 기록을 순서대로 보존한 본문이다.

### 후속: DriveTree 로컬 계약·QA 준비

위 표는 읽기 전용 조사 당시의 후보/결과로 보존한다. 이후 사용자 진행 승인으로 DriveTree의
QA·문서 계약 연결과 격리 시험을 진행했다. 제품 로컬 커밋 `b5fd437`(기준 `bd634e6`)에
AGENTS·기존 quality-remediation 스펙·실행 원문/지문 JSON과 새 trusted workflow,
실제 HTTP parser 회귀 4개·검색 출처 응답/DB 긍정 단언을 보존했다. runtime/schema/lock은 변경하지 않았다.

양쪽 format/lint/build와 backend 단위 70·실DB 통합 17, frontend 단위 8·Chromium 20이 PASS다.
DB는 새 pgvector/pg16 container의 loopback 전용 합성 fixture이며 운영 DB/키를 사용하지 않았다.
검색이 빈 배열인 반례를 새 단언이 검출하고 원본 복구 후 통합 검사를 다시 통과했다.
독립 검토의 검색 긍정 단언 공백은 보완 후 재검토에서 해소됐고 추가 P1/P2 finding은 없었다.
로컬 정본 자산 점검은 18/18 PASS이나 이는 신뢰 target 이벤트의 원격 실행 증거가 아니다.

보안 감사는 전체 backend 28·frontend 20이며 운영 의존성에도 각각 critical 1건이 남는다
(`proxy-addr`, `next`; 실제 악용 가능성은 미확인). 전체 보안/배포 준비는 FAIL이다.
원격 CI/PR·병합·main/default 배치·required context 변경·배포는 아직 실행하지 않았다.
develop 병합은 staging 자동 배포에 연결되므로 로컬 준비 완료를 배포 승인으로 확대하지 않는다.
후속 상태와 제품 기록·현재 후보 인계는 [이슈 #496](https://github.com/grinvi04/team-harness/issues/496)을 따른다.
다른 소비 프로젝트는 이 최초 후보 후속에서는 변경하지 않았다. 최신 승인·진행은 다음 절을 따른다.

### 후속: 네 소비 프로젝트의 로컬 적용 진행

사용자가 네 소비 프로젝트 모두의 진행을 승인했다. 위 조사 당시의 보류 상태를 보존하며,
현재 범위는 제품별 최소 계약·보안 보완, 격리 fixture QA, 관련 문서 현행화와 로컬 후보 보존이다.
원격 전달·main/default 검사 활성화·보호 정책 변경·운영/staging 배포의 완료로 확대하지 않는다.

아래는 최초 조사나 첫 DriveTree 후보와 구분한 **현재 로컬 후보**다. 제품별 실사용 사례는 제품 저장소에 두고 공통 Harness의 QA 계약만 연결했다. 이전 실패·미실행 결과는 제품 증거에서 보존한다.

| 제품 | 현재 로컬 후보 | 실제 로컬 검증 | 보안·검토 상태 / 한계 |
|---|---|---|---|
| DriveTree | `907ea04` | Swagger YAML·Prisma 내부 보완 유지. backend 단위 70·새 DB 통합 19/migrate 3와 frontend Chromium 20은 이전 동일 앱 입력 증거 재사용. 새 braces PR #78 고정 보완·클린 npm ci 6파일 적용·보안 10·형식/lint PASS. frontend 단위 8·build는 40ffba2 원문 재사용 | 새 설치기 후보 독립 검토 기존 P2 해소·추가 P1/P2 없음. braces source 6·설치 6·원문 34개 지문 일치, 앞선 Prisma 연구/QA 기록 보존. 전체 감사 backend moderate 20/high 0·frontend high 5 FAIL; 운영 backend 0·frontend 0. 원격 CI·병합·배포 미실행 |
| siku | `b6ed228` (코드 `5ad8a96`) | 클린 설치·형식·lint·build, 단위 86·실제 Auth/RLS/Storage 브라우저 25 PASS, 재시도 0, 전체 감사 0 | 코드·문서 독립 검토 기존 P2 해소·추가 P1/P2 없음. 권한 없는 0행 삭제 뒤 파일 보존, DB 삭제 뒤 Storage 실패의 함수·UI 부분 실패 처리 확인. 원격 DB 드리프트 미측정·DB/Storage 원자성 보장 안 함 |
| ERP | `7a13802` (보완 코드 `18b18a06`, 기존 기반 `b3fbfb36`) | braces 보안 회귀 11·FE 단위 60·Chromium 38(재시도 0), 타입/포맷/린트/디자인/빌드·CLI help·Docker deps/full PASS. CSS 2개·로그인 desktop/mobile·합성 인증 shell PNG 동일. Java 957·실 Keycloak은 backend 입력 불변으로 이전 증거 재사용 | 고정 후보 독립 검토 추가 P1/P2 없음. 합성 세션·backend 미기동 브라우저 smoke와 실제 HTTP BFF 세션 경계만 이번 실행. 전체 high 9/운영 high 7 FAIL·원격 보류 |
| webhook-service | `c4214248` (develop merge; PR head `aee5ccf`, 동일 앱 입력 `ef6585a`) | python-keycloak 7.1.1·공유 JWK decode·RS256/엄격한 만료/exp 필수·승인된 admin 역할 유지. 새 Python 환경 전체 110·집중 31, Ruff format/lint·mypy·Alembic 단일 head·pre-commit PASS. 별도 Keycloak 22.0.5·Chrome의 실제 로그인/코드 교환/callback·admin 허용/viewer 거부 PASS | 코드·문서 고정 후보 독립 검토 추가 P1/P2 없음. product source 20·설치/probe source 6·원문 93개 지문 일치. 전체 해석 runtime 74개 패키지·dev 포함 91개 pin graph 감사 각각 0. PR #71 필수 원격 CI/독립 검토·develop 병합 확인. 운영 realm issuer/audience·키 회전·main/default 검사 전환·배포 미확인 |

DriveTree의 최초 증분 lock 설치 실패와 클린 lock 복구, siku의 공식 CLI 서명/바인딩 차단·저장소 xattr 실패·PNG fixture 거부, ERP의 초기 포트 바인딩 문제·curlrc 반례·재사용 시험 DB 잔여 데이터로 인한 Java 2 FAIL(새 전용 DB에서 957 PASS), webhook의 최초 훅 환경 실패는 성공으로 덮어쓰지 않는다. 추가 커밋 훅의 잘못된 DB 사용자명에 의한 76 PASS·2 인증 오류는 보고를 보존했으나 전체 stdout 원문은 미보존이라는 한계도 명시했다. 올바른 전용 설정의 직접 driver 연결·최종 전체 훅은 새 원문으로 확인한다. 실제 실패 원인을 바꾼 재시도만 진행했다. OS 보안·전역 Docker 설정·RLS·기존 CI gate를 완화하지 않았다.

ERP는 원래 feature checkout과 기존 미추적 작업을 그대로 보존한 별도 worktree다. 모든 실서비스 시험은 새 합성 자격증명·데이터를 사용했으며 실제 공개 포트의 loopback 바인딩을 확인하고 사용한 전용 서비스의 중지를 확인했다. 제품 증거의 관찰 경계를 넘어 외부 인증·모든 업무 API·운영 데이터의 품질을 보장하지 않는다.

webhook의 이전 60/69/77 시험은 명시 주입한 로컬 DB/큐 실행 결과이며 기존 `.env`의 자동 로딩 차단 증거로 쓰지 않는다. 78개 후보에서 Pydantic 최초 import 전 차단과 합성 provider 회귀는 확인했으나 pytest-dotenv의 선행 로딩은 차단하지 못했다. 최종 `5fd2213`에서 초기 플러그인 로딩도 차단하고, 설치된 플러그인을 사용하는 실제 시작 회귀의 RED→GREEN과 전체 79 PASS를 확인했다. 앞선 자동 읽기 차단 주장은 제품 기록에서 철회·한계로 보존했다. 운영 설정 파일을 직접 조회하거나 제품 설정의 기본 동작을 바꾸지 않았다.

현재 증거 정본은 각 제품의 `docs/specs/quality-remediation.md`(siku/DriveTree), ERP의 `docs/specs/tenant-user-onboarding.md`와 외부 QA manifest, webhook의 `docs/qa/2026-10-07/README.md`와 해당 실행 manifest다. 선정한 로컬 QA·독립 검토·감사 FAIL·원격 gate 상태를 각각 기록한다. 새 trusted 파일 존재는 target 이벤트 실행/보호 강제의 증거가 아니다.

ERP 새 Java 원문·XML 172개/957 PASS와 siku 최종 기록의 독립 대조에서 추가 P1/P2 없음과 지문 일치를 확인했다. 네 고정 로컬 후보의 선정한 기능·회귀 검증과 독립 검토 인수는 마쳤다. 이후 Swagger YAML·관리자 인증 보완도 아래 기록의 고정 후보에서 인수했다. 최신 Prisma 내부 의존성 후보의 QA·독립 검토도 아래 기록에서 인수했다. 그 로컬 인수 시점의 다음 단계는 보류한 Vercel 확인과 정확 후보의 원격 전달·trusted 검사 초기 배치 조건 해결이었다. 현재 원격 인수와 다음 행동은 맨 아래 소비 원격 전달 후속을 따른다. 최신 로컬 보완·검증 결과는 아래 후속 기록을 따른다. main/default 배치·검사 전환·배포는 별도 단계다. 전체 소비 도입/보안/배포 준비는 아직 **NOT VERIFIED**이며 [이슈 #496](https://github.com/grinvi04/team-harness/issues/496)은 열어 둔다.

### 후속: 보안 잔여와 원격 전달 조건 조사

2026-10-07 사용자 진행 승인으로 현재 lock·공식 registry/advisory·GitHub 브랜치 보호·workflow와 최근 deployment 기록을 읽기 전용으로 대조했다. 조사 자체를 제품 적용·설치 또는 제품 실경로 악용 검증이나 새 후보의 원격 CI 통과 판정으로 취급하지 않는다. 이후 적용한 고정 후보의 로컬 결과는 위 표와 다음 기록에 구분한다.

- **DriveTree 최소 후보:** Swagger 11.4.7의 정확 pin인 `js-yaml 5.3.0`은 [merge 예산 우회](https://github.com/advisories/GHSA-r3ph-w7gj-g6xm)에 해당한다. 공식 수정은 5.4.1 이상이며 registry의 5.4.3을 별도 임시 디렉터리에 scripts 비활성으로 설치해 합성 OpenAPI 객체 dump/load 왕복과 merge 예산 10/빈 source 11개를 시험했다. 현재 5.3.0은 예산 초과를 허용(RED), 5.4.3은 거부(GREEN), 정상 왕복은 양쪽 PASS다. 원문은 `/tmp/drivetree-yaml-compat-vLNpXM/yaml-compat.log`이며 이 라이브러리 조사 단계에서는 제품 파일/lock을 변경하지 않았다. 이 표본은 Swagger·제품 전체 호환성을 증명하지 않는다. 실행은 해당 임시 cwd의 Node stdin 검사(exit 0)이며 원문 SHA-256 `d9a14eb962fcd4bb542495b2f0e1fd10d5b5533214a96a4a4aabf6cb688ef1ab`다. 원문은 다음에 보존한다. 후속 제품 후보 `8c5b4f8`에서는 Swagger 아래에만 override를 적용했다. 실제 API 문서 JSON/YAML 생성·조회와 예산 초과 거부 RED→GREEN, backend 단위 70·실DB e2e 19, 클린 lock 설치·format/lint/build를 통과했다. 초기 증분 lock 설치 실패도 보존했다. 독립 검토에서 source 4·원문 18개 지문과 loopback fixture 종료를 확인했고 추가 P1/P2는 없었다. 전체 audit 24건·운영 high 4건은 FAIL이며 frontend 8+20은 이전 증거 재사용이다.
```json
{
  "old": "5.3.0",
  "candidate": "5.4.3",
  "validRoundTrip": "PASS",
  "oldExceedsBudget": "accepted RED",
  "patchedExceedsBudget": "rejected GREEN",
  "scope": "library-only synthetic, no Swagger/app/full QA"
}
```

- **DriveTree 다른 전이:** 현재 Prisma 7.10.0은 mysql2 3.15.3, @prisma/config는 deepmerge-ts 7.1.5를 고정한다. registry의 최신 config 7.10.0도 동일 pin이다. [deepmerge-ts 수정](https://github.com/advisories/GHSA-ggr8-5vv4-36mx)은 8.0.0부터이며 [상위 이슈](https://github.com/prisma/orm/issues/30052)의 override 제안은 소비자 보고이지 upstream 호환성 보증이 아니다. Map 병합 의미 변경을 포함하므로 config·validate·generate·새 격리 DB migrate deploy·실제 ORM 흐름 회귀가 필요하다. mysql2의 [인증 downgrade](https://github.com/advisories/GHSA-3f6p-5ww8-9rcr)·[압축 해제 위험](https://github.com/advisories/GHSA-rgwj-5xj2-c3m3)은 별도 제약이다. 실제 제품은 PostgreSQL이며 MySQL 실행 경계의 도달성은 미확인이다. Prisma 6으로 내려 audit만 통과시키지 않는다.
- **공식 수정판 없는 항목:** registry의 braces는 3.0.3, sprintf-js는 1.1.3이다. [braces 이슈](https://github.com/micromatch/braces/issues/73)·[보완 PR #78](https://github.com/micromatch/braces/pull/78), [sprintf-js advisory](https://github.com/advisories/GHSA-hp3w-g68c-fv3c)를 근거로 upstream release 대기와 소비자 별도 보완을 구분한다. 샘플 patch를 자동 복사하거나 구버전 도구로 내려가지 않는다. 개별 patch를 채택하면 설치 후 검증·반례·원래 tool 동작·제거 조건을 제품 스펙에 연결해야 하며 audit 경고가 자동으로 사라지는 것은 아니다.

| 제품 | 이 조사 당시 읽기 전용 원격 확인 | 전달·병합 영향과 미확인 |
|---|---|---|
| DriveTree | default main, develop `bd634e6`, main `49621e6`; strict/app-bound 필수 context develop 6개·main 5개, enforce_admins true | 현재 후보의 원격 CI는 미실행. develop의 Vercel Preview 배포 기록 확인. 저장소 CI/규약은 develop→Railway staging, main→Railway/Vercel production을 명시하지만 당시 Railway 연결 상태는 미조회; 후속 metadata 조회 결과와 남은 미확인은 아래 참조. fix/feature의 CI-only 주석만으로 외부 Preview 배포 없음으로 확정하지 않음 |
| siku | default main, develop `c7b5bbd`, main `351ec7d`; 양쪽 strict/app-bound 필수 context 6개, enforce_admins true | CI는 PR에서 합성 Supabase·브라우저 흐름 실행. develop SHA의 Vercel Preview와 main SHA의 Production 배포 기록 확인. 새 후보의 Preview/원격 CI는 미실행이며 Supabase 원격 DB 드리프트 미측정 |
| ERP | default main, develop `d10a916`, main `8d83be6`; 양쪽 strict/app-bound 필수 context 8개, enforce_admins true, HARNESS_SYNC_ENABLED=true | Actions에 push/deploy/publish trigger 없음. 문서상 main→Railway/Vercel 재배포는 연결 활성 시 조건부이며 README local-only·deployment API 0과 구분. 외부 제어판 상태 미확인. develop PR은 기존 품질/repo-sync 검사, Preview 가능성은 별도 확인 |
| webhook-service | default main, develop `83cd398`, main `b905198`; 양쪽 strict/app-bound 필수 context 5개, enforce_admins true | build-and-test·alembic-heads·secret-scan 등 품질 후 main push에서만 GHCR latest 이미지 게시. develop PR/merge를 운영 서버 배포 완료로 간주하지 않으며 이미지 게시 후 소비 서버 갱신 연결은 미확인 |

ERP high 9건은 전부 braces에 연결되며 운영 그래프에도 high 7건이 남는다. shadcn 4.21.3의 CSS·registry·ts-morph 경로와 Next ESLint 경로를 확인했다. registry 최신 버전에도 전체 해소 경로가 없다. 강제 shadcn 1/Next ESLint 14 전환은 `shadcn/tailwind.css` export와 ESLint 9 계약을 깨뜨려 적용하지 않는다. 배포 standalone에 해당 디렉터리가 없다는 관찰은 전체 운영 안전의 증명이 아니다. zero-high가 필수면 CSS/CLI·lint 도구 교체 또는 소비자 보완을 별도 설계하고 시각·BFF·품질·클린 설치 회귀를 수행해야 한다.

webhook의 urllib3 1.26.20은 python-keycloak 2.0.0 제약으로 묶이며, 2.16.6 후보의 urllib3 2.8.0 해석 성공과 pkg_resources import 실패는 기존 기록을 보존한다. setuptools 호환 pin을 동반한 2.x 후보는 urllib3 경로만 개선하는 별도 시험 대안이며 전체 보안 해소가 아니다. [python-jose <=3.5.0](https://github.com/advisories/GHSA-3qf3-8w2g-rqmx)·[python-ecdsa](https://github.com/tlsfuzzer/python-ecdsa/security/advisories/GHSA-wj6h-64fc-37mp)는 공식 수정판 없음/라이브러리 보안 한계와 실제 호출 도달성을 구분한다. 현 SDK의 decode 기본 algorithms는 RS256으로 제한되어 있지만 외부 realm·키·issuer/audience·rotation 결과는 미확인이다. jwcrypto를 쓰는 상위 major 전환은 token decode·키 형식·클레임 검증 의미를 별도로 시험해야 하며 이번 로그인 수선에서 임의 전환하지 않는다. webhook에서는 실제 SDK에 없는 토큰 교환 메서드, 중복 realm URL, callback 이름·SQLAdmin mount 순서와 GET 로그인 연결을 고쳤다. API/UI의 공유 공개키를 PEM으로 정규화하고 실제 SDK의 자체 RSA 토큰 검증을 확인했다. 앞선 `5fd2213`의 79 PASS는 관리자 로그인 수용 흐름을 포함하지 않았으며 인증 전체의 증거로 확대하지 않는다. 사용자는 관리자 UI도 `realm_access.roles`의 `admin` 보유자만 허용하도록 명시 승인했다. UI와 기존 Replay 역할 검사는 정확한 목록 형식만 허용하고 잘못된 형식도 거부한다. OAuth state는 브라우저 세션 결박·5분 만료와 Redis 예약/원자적 `GETDEL`로 코드 교환 전에 일회 소비한다. 이전 서명 쿠키 재생·다른 브라우저·누락/불일치/만료·경쟁 소비·Redis 오류를 시험했다. callback 토큰 교환 뒤 보호된 UI 경로에서 역할을 검사한다. 새 로컬 후보 `eba4bfb`의 focused 25·전체 기존/새 환경 각각 104 PASS, Ruff format/lint·mypy·Alembic 단일 head·pre-commit PASS와 fixture 종료와 고정 후보 독립 검토 추가 P1/P2 없음을 확인했다. callback 흐름의 Redis는 대역이며 실제 Redis는 동시 `GETDEL` 단일 소비를 별도로 검증했다. 이는 자체 RSA·합성 HTTP·실제 격리 Redis/DB에 한정하며 외부 realm·redirect·issuer/audience·키 회전·실제 브라우저 상호 운용성은 미확인이다.


네 소비 repo의 원격 main/develop에는 새 `commitlint-trusted.yml`이 모두 없어 최초 PR의 신뢰 검사 실행을 완료로 간주할 수 없다. 기존 required `commitlint`는 유지되지만 PR 쪽 validator를 실행하는 한계가 있다. [기존 전환 순서](../specs/trusted-commitlint.md)에 따라 기본 브랜치 정본 배치, 이후 새 PR 이벤트의 동일 후보 신뢰 context 실행, 서버 필수 목록 추가/readback, 기존 context 제거 순서를 구분한다. 기본 브랜치 배치 자체의 자동 배포 영향도 먼저 확인해야 한다. 파일 존재·기존 commitlint green·로컬 repo-sync PASS는 이 활성화의 증거가 아니다.

[GitHub 공식 정책 안내](https://docs.github.com/en/actions/reference/security/securely-using-pull_request_target)는 public repo의 기본 pull_request_target 정책이 현재 evaluate 모드이며 해당 대상에서 2026-11-02 집행 전환을 예고한다. 이미 적용한 별도 정책의 예외가 있어 네 repo가 모두 차단된다고 단정하지 않는다. 전달 전에 실제 Actions event policy·권한·target 실행 가능성을 읽기 전용 확인해야 한다. 정책을 자동 완화하거나 PR 코드를 높은 권한으로 실행하도록 전환하지 않는다.

#### 잔여 의존성의 격리 후보 비교 (2026-10-07)

DriveTree의 Prisma 7.10.0을 유지한 합성 복사본에서 `@prisma/config` 아래 deepmerge-ts 8.0.0과 `prisma` 아래 mysql2 3.23.1만 교체했다. 현재 `prisma.config.ts`는 문자열 설정이며 Map을 쓰지 않는다. v8 Map 병합 의미 변경은 별도 표본으로 보존했다. 클린 설치·Prisma validate/generate는 합성 URL과 dotenv 비활성 조건에서 통과했고 DB 연결은 하지 않았다. scratch lock 감사는 backend 전체 24→20(moderate), 운영 high 4→0이다. 이는 제품 인수 PASS가 아니다. 후속 제품 후보 `0a654e0`에 최소 변경을 적용하고 클린 설치·실제 resolve·validate/generate·backend 품질·단위 70·새 격리 DB migrate 3/실DB e2e 19를 통과했다. source 12·원문 21개 지문을 대조했고 fixture 종료를 확인했다. 제품 운영 감사 0·전체 개발 도구 moderate 20 FAIL이며 고정 후보 독립 검토에서 추가 P1/P2 없음과 원문 지문 일치를 확인했다. MySQL 연결과 Map 설정의 호환성은 이 제품 PostgreSQL 검증의 범위 밖이다. frontend braces와 backend dev sprintf-js의 경고는 이 변경으로 해소되지 않는다.

webhook의 두 SDK 대안도 제품 `eba4bfb`를 바꾸지 않고 scratch 환경에서 비교했다. 2.16.6 + setuptools 80.10.2는 해석/import와 서비스 비의존 인증 시험 24개를 통과하지만 setuptools의 새 보안 경고를 도입해 권고하지 않는다. 3.9.1은 jwcrypto로 바뀌며 현재 호출 옵션을 유지하면 **만료된 유효 서명 토큰을 거부하지 않는 회귀**가 발생했다. 시험 보조 패키지 누락의 최초 collection 오류와 실제 만료 검증 RED를 구분해 보존한다. 현재 SDK 의존성을 무조건 올리는 대신 키 형식·클레임/만료·issuer/audience·회전 계약을 명시한 별도 전환이 필요하다. 10초 만료 표본은 jwcrypto의 60초 허용 오차와 혼동할 수 있어 별도 동일 RSA/옵션 probe로 exp -120/-10/+300을 비교했다. 2.0.0은 두 만료값을 거부하고 미래값을 허용했지만 3.9.1은 모두 허용했다. 설치 SDK의 `check_claims={}`와 jwcrypto의 `check_claims is None` 조건을 원본에서 대조해 허용 오차 밖 만료 거부 실패를 확인했다. 3.9.1 runtime 감사 0건과 인증 시험 FAIL은 별도 판정이다. 비교 후보의 만료 수용은 독립 검토에서 P1로 판정되어 채택하지 않는다. 이 비교 당시 제품 `eba4bfb`는 변경 없는 clean 상태였다. 소스 13·원문 25·설치 SDK 소스 3개 지문은 독립 대조에서 모두 일치했다. 2.16.6 후보의 runtime 감사는 ecdsa/jose/setuptools 3개 패키지·5개 중복 포함 항목 FAIL이다. 이 비교를 제품 전체 QA 또는 실제 Keycloak 연동으로 확대하지 않는다.


격리 비교 근거: `/tmp/drivetree-prisma-compat-20261007/research.json`, 소스 6·원문 24, SHA-256 `373247c95be2ea8f9720518cbebca6c814006e6fa6f417b706d958c9ee956cd8`. 명령·cwd·종료와 원문 지문을 해당 기록에 보존한다.


격리 비교 근거: `/tmp/webhook-keycloak216-compare-20261007/manifest.json`, 소스 13·원문 25·설치 SDK 소스 3, SHA-256 `0200302fa63cf5047d312e916e8b88fbd7c612deef05529469ad15df297dc72e`. 명령·cwd·종료와 원문 지문을 해당 기록에 보존한다.
