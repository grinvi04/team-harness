# 개별 스택·화면 방식과 버전 검증 설계

## 합의와 현재 단계

2026-10-12 사용자는 기존 프로젝트의 설정·버전 검증과 React+Vite·Nuxt 추가를 승인했다.
같은 날 Python 프레임워크 구분·Rails Hotwire/Inertia·개별 조합 중심으로 명세 수정과 구현 계획 작성도 승인했다.
기준은 `fix/structure-cleanup`의 `c701eccb3b25820bdc14b9d2f144d54089d19a15`다.
첫 명세는 로컬 Git의 `git show c701ecc:docs/specs/stack-profiles-version-contract.md`로 읽는다.
이 커밋은 원격에 올리지 않았다. 로컬 작성과 원격 전달을 구분한다.
사용자는 [구현 계획](stack-profiles-implementation-plan.md)을 검토하고 Native 순차 구현·마지막 독립 검토를 승인했다.
이전 [구조 정리](structure-cleanup.md)의 구현·검증 완료를 이번 기능의 실행 증거로 사용하지 않는다.
[제품 방향](../product-direction.md) 판정은 **소유**다. 설정·검사 연결을 소유하고 생태계의 공식 기능을 활용한다.

## 목표와 보존 경계

- 기존 프로젝트의 프레임워크·화면 방식·버전을 확인하고 필요한 Harness 설정과 검사만 연결한다.
- 고정 풀스택 템플릿을 만들지 않는다. 개별 스택·공통 자산·선택한 UI 자산을 조합한다.
- 특정 소비 프로젝트의 도메인·폴더·회사 정책·DB·Redis·Celery를 기본값으로 넣지 않는다.
- 검사·셋업은 앱 생성·의존성 설치/업그레이드·lockfile 재작성·DB·인프라 변경을 수행하지 않는다.
- CI의 기존 lock 기반 의존성 설치와 품질 검사 명령은 보존한다.
- 가드·시크릿 검사·필수 CI·브랜치 보호·사용자 파일·지도·복구 자료와 기존 명령 호환을 보존한다.
- 소비 원격·배포·결제·전역 설정/설치와 Claude 인증·실제 모델 검증은 제외·보류한다.
- 명세·계획 작성, 구현·검증, PR·병합·발행·설치를 각각 구분한다.

## 개별 스택과 프레임워크

| 기존 번호·키 | 역할과 선택 |
|---|---|
| 1 `node` | Node·TypeScript backend. 기존 frontend 역할은 호환 입력으로만 유지 |
| 2 `spring-boot` | Spring Boot backend. 주 안내는 API+독립 frontend |
| 3 `python` | `django`·`fastapi`·`flask` 개별 프로필; 기존 범용 Python 선택은 호환 유지 |
| 4 `rails` | Rails backend와 기존 앱 안의 UI 방식 선택 |
| 5 `nextjs` | Next.js frontend, 서버·브라우저 경계를 구분 |
| 6 `vue` | Vue+Vite frontend |
| 7 `react` | React+Vite SPA frontend |
| 8 `nuxt` | Nuxt frontend |

기존 1~6의 번호를 유지하고 React·Nuxt를 뒤에 추가한다. 사용자 추가 지시로 2번 키/경로를 `spring-boot`로 통일한다.
기존 `spring` CLI 입력은 호환 별칭이다. 공식 패키지명·`spring.*` 설정키·Spring Framework 개념·과거 증거는 정확히 보존한다.
Node는 런타임이며 독립 frontend 프레임워크처럼 추천하지 않는다. 기존 `1+1` 등은 호환 검사에 남긴다.
Python 메뉴에서 Django·FastAPI·Flask를 각각 선택하고 공통 Python 설정을 재사용한다.
프로젝트의 확인 가능한 의존성으로 프레임워크를 판정한다. 여러 개가 설치돼 있으면 명시적 선택을 받는다.
알 수 없는 프레임워크를 FastAPI로 가정하지 않는다. 기존 범용 Python은 새로운 기본 추천이 아니다.

## 화면 구성과 조합

| 구성 방식 | 적용 대상과 선택 |
|---|---|
| API·frontend 분리 | Node·Spring Boot·FastAPI, API로 사용하는 Django·Flask·Rails + React·Next.js·Vue·Nuxt |
| 서버에서 화면 생성 | Django Templates, 선택적 HTMX; Flask Jinja; Rails ERB+Hotwire |
| 서버와 JS 화면 연결 | Rails Inertia+React 또는 Inertia+Vue; Rails 라우팅·세션·컨트롤러를 활용 |

선택값은 Django `templates|htmx|api`, Flask `templates|api`, FastAPI `api`다.
Rails는 `hotwire|inertia-react|inertia-vue|api`를 받는다. Inertia는 Rails 기본 설치물이 아닌 선택 구성이다.
Hotwire는 Turbo·Stimulus를 가리킨다. 기존 앱이 이 구성을 쓰는지 확인하고 설치하지 않는다.
Django의 HTMX·DRF도 선택 사항이다. Templates·API 선택만으로 해당 패키지를 강제로 요구하지 않는다.
Rails의 Inertia 화면은 같은 Rails 앱 안에 있으므로 `backend/frontend` 폴더 분리를 강제하지 않는다.
API 분리형만 서로 다른 프로젝트 경로와 각자의 CI job을 조합한다.
화면 방식의 근거가 부족하거나 여러 방식이 공존하면 명시적 선택을 받고 해당 범위만 검사한다.
기존 프로젝트를 다른 방식으로 자동 변환하지 않는다. 미설치 UI·충돌하는 선택은 적용 전에 거부한다.
서버 화면/연결형에 별도 frontend를 자동 덧붙이지 않는다. API 조합 요청은 `api` 선택과 일치해야 한다.
첫 명세의 20조합은 분리형 선택의 산술 목록이었다. 전체 지원 방식이나 실제 제품 호환의 완료 기준으로 쓰지 않는다.
기존 12조합 회귀와 새 선택·UI 방식·거부 사례를 각각 검증한다. frontend끼리·같은 경로 조합은 거부한다.
React+Vite는 SPA다. SSR·RSC가 필요하면 [React 안내](https://react.dev/learn/build-a-react-app-from-scratch)를 따라 프레임워크 선택을 검토한다.

## 정본과 직접 소비자

`templates/stacks.json`을 선택·역할·프로필·자산·rule·버전 검사 대상의 단일 카탈로그로 유지한다.
스택별 정본은 `templates/stacks/<스택>/`이며 공통 CI는 `templates/ci/common/`에 둔다.
Python 전문 자산은 `python/frameworks/{django,fastapi,flask}/`, Rails UI는 `rails/ui/<선택>/`에 둔다.
프레임워크별 차이만 분리하고 Python/Rails의 공통 job·명령·rule을 복제하지 않는다.
React 공통 rule은 Next.js도 읽고 Vue 공통 rule은 Nuxt도 읽는다. SPA 전제를 SSR에 강제하지 않는다.
TypeScript 공통 rule은 기존 정본을 재사용한다. 셋업·생성·repo-sync·검사 reader를 함께 이전한다.
기존 생성물·번호·명령을 유지한다. 현재 지원하는 npm·Gradle·pip·Bundler 밖의 빌드 도구는 추가하지 않는다.
Spring Boot·Vue local checker의 무옵션·개별·조합 명령을 유지한다. 새 UI local checker는 추가하지 않는다.

## 버전 선택과 기록

런타임·프레임워크·주요 빌드 도구·실제 UI 의존성을 따로 확인한다.
React: Node·React/react-dom·Vite·React plugin. Nuxt: Node·Nuxt·Vue·사용 중인 module.
Python: Python·선택한 Django/FastAPI/Flask. Rails: Ruby·Rails·선택한 Hotwire/Inertia·JS adapter.
Spring Boot: Java·Spring Boot·Gradle wrapper. Next.js·Vue·일반 Node도 실제 의존성을 확인한다.

| 우선순위 | 선택 규칙 |
|---|---|
| 사용자 지정 | 구성요소별 정확한 버전 또는 명시적 `latest` |
| 기존 프로젝트 | 지정이 없으면 manifest·lockfile·런타임 선언의 확정 버전 보존 |
| 미지정 기본값 | 최신 안정 버전을 제안하고 조회 시점의 정확한 버전으로 기록 |

`latest`는 영구 저장하는 버전이 아니다. prerelease·nightly는 기본 선택에서 제외한다.
Node의 기본값과 `latest`는 호환되는 최신 지원 LTS다. 다른 지원 안정 버전은 정확하게 지정할 수 있다.
Java는 선택한 배포판의 지원 LTS와 Spring Boot·Gradle 조건을 본다. 배포판을 임의 선택하지 않는다.
Python·Ruby는 프레임워크가 지원하는 안정 버전을 고른다. 지원하지 않는 최신 버전은 선택하지 않는다.
범위 선언을 설치 버전으로 보고하지 않는다. 조회한 최신 버전으로 기존 앱의 불명확한 버전을 채우지 않는다.
요청·기존 버전 차이, 선언·lockfile·런타임 충돌은 조치 안내와 함께 적용을 중단한다.

검사 진입점은 `scripts/check-stack-versions.mjs --project <경로> --stack <선택>`이다.
`--framework`·`--ui`와 조합의 `--backend-dir|--frontend-dir`로 선택을 전달하고 `--version <역할.구성요소=버전>`은 반복해서 지정한다.
역할은 단독 `project`, 분리형 `backend|frontend`다. 예: `frontend.node`, `backend.python`, `project.rails`.
기본 실행은 읽기·결과 출력이며 파일을 쓰거나 프로젝트 코드를 실행하지 않는다.
`--apply`는 호환 확인 뒤 `harness-stack.versions.json` 하나를 원자적으로 새로 저장한다. 기존 파일은 덮어쓰지 않는다.
기록에는 선택·관측/대상 버전·공식 출처/조회 시각·입력 지문·판정을 담고 비밀정보·전체 그래프·중복 과거 로그는 제외한다.
셋업도 동일 판정자를 적용한다. 충돌/미확인은 파일 생성·브랜치 보호 변경 전에 중단한다.
CI는 이 기록의 정확한 런타임과 기존 lockfile을 사용한다. 입력이 바뀌면 재검사를 요구한다.
CI마다 latest를 조회하지 않는다. 갱신은 명시적인 재검사에서만 제안하며 앱 의존성을 수정하지 않는다.
기존 CI 명령·권한·action pin은 보존하고 런타임 지정은 확인한 기록에 맞춘다.

## 판정과 확인 가능한 범위

공식 릴리즈·해당 버전의 metadata·지원 조건으로 runtime·peer·plugin·UI adapter 제약을 대조한다.
선언 호환, 충돌, 미확인을 구분한다. 충돌/미확인은 nonzero이며 부족한 근거와 사용자 조치를 표시한다.
선택 의존성은 미사용이면 요구하지 않는다. 사용 중인데 필요한 조건을 확인할 수 없으면 미확인이다.
오프라인은 정확한 버전과 확인 가능한 공식 근거가 있는 항목만 판정한다. 조회 실패를 PASS로 대체하지 않는다.
metadata가 없거나 동적 선언·미지원 lock 형식은 미확인이다. 새 장기 캐시·범용 의존성 해결기를 만들지 않는다.
버전 범위는 npm semver·PyPA packaging·RubyGems 등 생태계의 해석기를 사용한다.
필요한 검사 도구는 Harness 안의 격리된 tooling으로 준비하며 소비 앱의 의존성이나 전역 설정에 넣지 않는다.
도구가 없으면 미확인으로 종료한다. 읽기 실행 중 도구를 자동 설치하지 않는다.
Java·Gradle은 선택한 릴리즈의 공식 지원 구간을 확인하고 추출할 수 없는 조건은 미확인으로 남긴다.
각 검사에서 본 구성요소와 제외한 범위를 표시한다. 전체 transitive graph·실제 앱의 안전을 보장하지 않는다.
서로 다른 프로세스의 버전을 같게 맞추지 않는다. 공유 런타임/의존성이 있으면 그 공통 제약을 검사한다.
API schema·인증·오류·시간 형식·CORS는 별도 [연결 계약](../api-standards.md)과 실제 통합 검사 대상이다.
선언 호환·앱 빌드/테스트·API 통합을 각각 기록하며 미실행을 통과로 표시하지 않는다.

## Spring Boot·Thymeleaf 확인 결과

2026-10-12 확인한 [State of Spring 2024](https://www.vmware.com/docs/vmw-the-state-of-spring)는 응답자1,464명 조사다.
내부 API 제공80%·외부 API 제공70%를 보고한다. 복수 선택 결과이며 Thymeleaf의 점유율이나 감소율이 아니다.
[현재 Spring Boot 문서](https://docs.spring.io/spring-boot/reference/web/servlet.html#web.servlet.spring-mvc.template-engines)는 Thymeleaf 자동 설정을 지원한다.
확인한 자료로 Thymeleaf 사용률의 연도별 감소나 '더 이상 쓰지 않는다'를 확정하지 못했다.
이 제품의 Spring Boot 주 안내는 API+React·Next.js·Vue·Nuxt로 둔다. 이는 제품 설계 판단이다.
Thymeleaf는 기존 서버 화면 프로젝트의 선택 사항으로 안내하고 강제 제거·자동 변환하지 않는다.
이번에 Thymeleaf 전용 profile·CI 생성 기능을 추가하지 않는다.

## 공식 안내·실무 패턴·문제 해결

공식 설명은 실제 major의 주제·migration 링크로 연결한다. 버전별 문서가 없으면 릴리즈 자료와 한계를 표시한다.
본문은 대상·선택 조건·필수 제약·실무 판단·문제 해결 순서로 짧게 쓴다. 공식 설치법·API를 복사하지 않는다.
필수 가드·권한·실패 차단·검증 계약은 본문에 남긴다. LLM은 해당 공통 rule→전문 rule→필요한 공식 링크만 읽는다.

| 주제 | 남길 판단과 조건 |
|---|---|
| frontend | 기능 경계, 서버 데이터/화면 상태, hook/composable 책임·취소·캐시 무효화 |
| 서버 화면·Inertia | 세션/CSRF, 요청별 상태, HTML escaping, props 공개 범위·폼 오류·navigation |
| SSR·Nuxt | hydration 진단, 요청별 상태, 서버 비밀/공개 설정, SSR/정적 생성 비용 |
| backend·운영 | 모듈형 모놀리스·트랜잭션, 필요한 CQRS/outbox/BFF, 멱등성·retry 예산·관측·복구 |

각 패턴은 문제·쓸 조건·피할 조건·비용·단순 대안·검증을 함께 설명하고 최소 설정 예시를 제공한다.
수치·계층·cloud·라이브러리를 모든 프로젝트에 강제하지 않는다. 회사 사례를 업계 표준으로 단정하지 않는다.
문제 해결은 증상·영향 버전·재현 조건·진단 순서·해결·재발 검사·근거를 남긴다.
공식에 있는 해결은 링크하고, 없는 내용은 확인한 복합 조건과 검증을 더한다. 추측을 기본값으로 쓰지 않는다.
[Django Templates](https://docs.djangoproject.com/en/6.0/topics/templates/)·[django-htmx](https://django-htmx.readthedocs.io/en/latest/),
[Flask Jinja](https://flask.palletsprojects.com/en/stable/quickstart/#rendering-templates)·[FastAPI 예시](https://fastapi.tiangolo.com/project-generation/),
[Rails Hotwire](https://guides.rubyonrails.org/v8.1/working_with_javascript_in_rails.html)·[Inertia Rails](https://inertia-rails.dev/guide/client-side-setup)를 연결한다.

## 수용 기준·검사와 종료

| 요구 | 필수 정상·실패·경계 사례 |
|---|---|
| 프로필/조합 | 기존6개·12조합, 새React/Nuxt, Django/FastAPI/Flask, Rails UI4가지; 잘못된 역할·경로 거부 |
| 기존 프로젝트 | 다중 framework/UI 선택, 미설치 adapter, Hotwire의 Node 불필요 사례, 선택 의존성 부재 |
| 버전 | 정확한 사용자 지정·latest·기존 버전, prerelease, runtime/peer 충돌, 선언/lock 상충, 조회 실패 |
| 안전/재현 | 미리보기 무변경, 적용 전 차단, 기존 파일/링크 보호, 원자적 실패 정리, CI 지문 drift 거부 |
| 문서 | 정본 발견·major 링크·조건부 패턴/진단, 특정 소비 프로젝트 내용 없음, 소유 Markdown199줄 이하 |
| 회귀 | Spring Boot/Vue checker, 기존 CI·가드·시크릿·권한·복구, 셋업/생성/repo-sync의 같은 선택·판정 |

구현 시 안내·카탈로그·reader·fixture·검사를 함께 갱신한다. 두 manifest·README·changelog도 동작 변경 때 맞춘다.
Team Harness 소스 후보0.91.0의 승인한 Task1~6 구현·로컬 검증을 완료했다. 발행·설치 완료는 아니다.
첫 quality 후보5acc8be는60/73, 수정 후보0b71c48은73/73 통과였다. 독립 검토는 네 Important 지적으로 FAIL이었다.
Python marker·Nuxt module·Hotwire pin·npm lock 경계를 한 차례 수정했다. 새 회귀7개·핵심/셋업74개·c1e8381 전체 quality73단계 통과다.
실제 소비 앱·원격 CI·호스트 훅·설치는 실행 증거가 없으면 미확인이다. fixture 통과로 대신하지 않는다.
현재 안내·체크리스트·지도를 결과에 맞춰 갱신했다. 독립 검토의 원래 FAIL과 최초 실패·재시험은 별도 보존한다.
구현 종료 조건은 위 기준 충족과 현재 안내·지도 일치다. 발행·설치를 자동 추가하지 않는다.

```harness-doc-sync
{"version":1,"record":"docs/specs/stack-profiles-document-sync.md"}
```

현재 단계는 승인한 로컬 구현·검증 완료다. Spring Boot 정식 이름 통일도 이번 범위에 포함했다.
계획의 완료 표시는 단계별 실행·커밋에 대응한다. 실제 앱 호환·원격 상태·설치 완료로 확대하지 않는다.

2026-10-12 별도 승인된0.91.0 전달·최종 검토 보완과 최신 단계는 [현재 전달 기록](stack-profiles-document-sync.md#0910-전달) 및 PR 원본을 따른다.
