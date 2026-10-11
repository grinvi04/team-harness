# 저장소 구조 후속 정리

## 목표와 현재 상태

사람이 설정을 찾고 고칠 때 정본과 영향을 받는 곳을 쉽게 알 수 있게 한다.
시작 후보는 develop `54657b3ef79ab36c3e0877664964356badd3510b`다.
사용자가 2026-10-12 검토안대로 진행하도록 승인했다. 구현·검증 결과는 아래에 이어 기록한다.
이전 [구조 정리](structure-maintenance.md)의 통과 범위를 전체 유지보수성의 완료로 확대하지 않는다.

사용자가 승인한 범위는 스택 자산, 현재 문서와 과거 기록, 실험과 발행 의존성, 안내와 로컬 잔재다.
로컬 지원은 기존 Spring·Vue 검사를 개별화해 조합한다는 답변으로 확정했다.
스택 정본 배치·역사 보존·호환 발행 모드도 마지막 설계 확인으로 승인받았다.
제품 방향 판정은 **소유**다. 기존 개발 구성과 검증 연결을 정리한다.

## 보존할 경계

- 가드·시크릿 검사·브랜치 보호·필수 CI와 실패 시 차단을 유지한다.
- 사용자 파일·지도·복구 백업·다른 작업공간은 보존한다.
- 공개 설치 단위는 기존 harness-guard 플러그인 하나다.
- 소비 프로젝트 원격 작업·배포·결제와 전역 설정·설치는 제외한다.
- Claude 인증 갱신과 실제 모델 실행 검증은 계속 보류한다.
- 새 앱 생성기, 다른 스택의 로컬 검사, 분리 플러그인 승격은 추가하지 않는다.

## 1. 스택별 자산의 정본

개별 스택에 속하는 파일은 `templates/stacks/<스택>/`에서 찾도록 옮긴다.
공통 파일은 현재의 공통 영역을 유지한다. 루트의 모든 파일을 한꺼번에 재배치하지 않는다.

| 대상 | 제안하는 정본 |
|---|---|
| 스택별 CI 원문 | `templates/stacks/<스택>/ci/{header,quality}.yml` |
| Spring·Vue 로컬 명령 | `templates/stacks/{spring,vue}/local-check.sh` |
| 스택별 rule | `templates/stacks/<스택>/rules/` |
| TypeScript 공통 rule | `templates/rules/typescript.md` |
| Spring 보조 설정 | `templates/stacks/spring/{Dockerfile,gitignore,checkstyle.xml}` |
| Next.js 이미지 예시 | `templates/stacks/nextjs/Dockerfile` |
| 공통 CI 원문 | `templates/ci/common/` |

`templates/stacks.json`에 원문·rule·보조 파일의 경로를 연결한다.
같은 경로를 셋업과 드리프트 검사에 각각 하드코딩하지 않는다.
카탈로그의 경로 기준 변경을 명시하며, 직접 reader를 함께 이전한다.
현재 생성 CI 여섯 개의 복사 경로는 유지하고 생성 안내를 제외한 명령·권한·action pin을 보존한다.
필수 위치의 Git·GitHub 사본 세 쌍과 Codex wrapper도 유지한다.

`Dockerfile.node`는 실제로 Next.js standalone 출력만 사용하므로 위 경로로 이름을 바로잡는다.
일반 Node·NestJS 이미지 지원으로 설명하지 않는다.
Spring 이미지의 기존 Gradle Groovy 전제도 사용 안내에 명시한다.

## 2. 로컬 검사를 개별 선택하고 조합

`setup-local.mjs --project <경로> [--apply]`는 기존 Spring+Vue 동작을 유지한다.
고정 조합 템플릿을 없애고 개별 명령과 공통 실행 틀로 checker 하나를 생성한다.
생성 파일은 Harness 설치 경로에 의존하지 않고 다른 작업 디렉터리에서도 동작한다.

명시적 선택은 `--stack spring`, `--stack vue`, `--stack spring+vue`로 제공한다.
단독 선택은 지정한 프로젝트 루트에서 검사한다.
조합의 기본 경로는 기존 `backend`·`frontend`이며, 경로 옵션은 조합에서만 받는다.
다른 스택 선택은 지원하지 않는다는 오류를 내고 파일을 쓰지 않는다.

- Spring: `./gradlew check bootJar`.
- Vue: `npm ci`, type-check, lint, test:unit, build, Chromium 준비, test:e2e 순서.
- 어느 단계든 실패하면 중단하며 마지막 PASS를 출력하지 않는다.
- 기본 실행은 미리보기이며 파일 쓰기·설치·검사를 수행하지 않는다.
- 기존 checker·연결 파일·연결 디렉터리와 사용자 설정을 덮어쓰지 않는다.
- 실제 앱 생성, package.json 변경, DB·인프라 준비는 수행하지 않는다.

## 3. 현재 안내와 과거 원문

현재 계약은 읽기 쉬운 Markdown으로 남기고, 과거 후보의 긴 로그·증거는 고정 Git으로 연결한다.
파일 이름이나 오래됐다는 이유만으로 지우지 않는다. 현재 reader와 보류 조건을 먼저 확인한다.

우선 정리 대상은 `docs/specs/`의 QA·다중 프로젝트 evidence JSON 일곱 개,
`standards-refresh/`의 과거 검토·실행 자료, 두 개의 긴 decisions 원문이다.
필요한 현재 결정은 `docs/decisions.md`와 해당 주제 안내에 짧게 남긴다.
기존 결정을 삭제해 사라진 것처럼 설명하지 않고 고정 커밋의 원문으로 연결한다.

`docs/pilots/`의 과거 실행 보고서도 같은 기준을 적용한다.
현재 검증이 읽는 원문은 고정 Git blob 읽기로 이전하고 기존 판정을 유지한다.
Git 원문 누락·다이제스트 불일치는 실패로 처리한다. 검증을 없애서 파일만 줄이지 않는다.
현재 binary trust와 external provenance manifest는 계속 유지한다.
manifest가 현재 파일의 다이제스트를 확인하는 외부 증거 JSON 일곱 개도 그대로 유지한다.
현재 소비 인수의 FAIL·미전환·배포 보류 조건, changelog와 시험 fixture도 유지한다.

삭제 전 원문은 시작 후보의 blob과 대조한다. 현재 문서의 링크와 복구 명령도 함께 바꾼다.
현재 안내에 남기는 역사 링크는 가변 브랜치 대신 전체 커밋 SHA를 사용한다.
소유 Markdown은 199줄 이하로 자연스럽게 나누며 긴 한 줄로 상한을 맞추지 않는다.
독자가 한 결정을 이해하기 위해 거대한 표 한 행을 읽지 않도록 문장을 나눈다.

## 4. 정식 발행과 분리 패키지 실험

정식 발행 검토용 명령에 `--source-only`를 추가해 실험 catalog·builder 없이 source bundle을 만든다.
기존 옵션 없는 명령은 staged package를 포함하는 호환 동작을 유지한다.
현재 artifact를 읽는 소비자가 있으므로 기본 출력 계약을 갑자기 바꾸지 않는 선택이다.
사용 안내에서는 정식 발행 준비와 실험 결과 생성 명령을 구분한다.

두 경로 모두 Git 후보를 한 번 고정하고 기록된 버전·source archive·checksum을 사용한다.
미완성 출력 정리, 기존 출력 덮어쓰기 거부, dirty 작업 제외를 유지한다.
source-only manifest의 packages는 빈 배열이며 직접 설치 가능한 패키지로 표시하지 않는다.
실험 출력의 `installable: false`, provenance·core 호환·runtime binding 검증은 유지한다.
실제 릴리즈에 필요한 외부 provenance 조회도 유지한다.
이 정리는 #412의 승격 조건 충족이나 실제 발행을 뜻하지 않는다.

## 5. 안내와 로컬 자료

README·구조 안내·로컬 개발·온보딩·유지보수 안내를 실제 배치와 명령에 맞춘다.
과거 구조 스펙의 당시 결과는 보존하고 이번 후속 작업으로 연결한다.
비어 있는 로컬 `src/infrastructure/sites/saramin` 트리는 파일 유무를 다시 확인한 뒤
빈 디렉터리만 정리한다. `.runtime/`의 검증된 복구 자료와 지도는 보존한다.
구현으로 바뀐 동작은 두 plugin manifest·README·changelog의 버전 계약을 함께 맞춘다.
버전 준비와 병합·발행·설치 완료는 각각 구분한다.

## 수용 기준과 종료 조건

1. 스택 명령·보조 파일·rule을 고칠 정본과 직접 소비자가 구조 안내에 하나씩 대응한다.
2. CI 여섯 개와 기존 조합, Spring·Vue 검사 순서와 실패 차단, 사용자 파일 보존이 유지된다.
3. 과거 원문은 고정 Git에서 읽을 수 있고 현재 정책·필수 읽기·회귀 판정은 유실되지 않는다.
4. source-only bundle은 실험 catalog 없이 생성되고 기존 bundle 계약도 회귀 검사를 통과한다.
5. 현재 문서·지도·체크리스트의 경로와 상태가 실제 후보·검사 결과와 일치한다.
6. 변경 범위 검사와 현재 후보 quality 전체, 다른 실행 인스턴스의 읽기 전용 검토를 통과한다.

검사는 정상 사례와 잘못된 선택·경로·심볼릭 링크·중간 실패·원문 누락 사례를 포함한다.
구조 확인은 테스트뿐 아니라 스택 수정·로컬 조합·현재 결정 찾기의 실제 읽기 경로로 평가한다.
기계적 검사 통과를 모든 유지보수성의 보장으로 표현하지 않는다.
위 범위가 충족되면 종료한다. 새 기능·새 스택·발행 작업을 완료 조건에 추가하지 않는다.

## 구현 순서와 검증 계약

승인된 명세와 native 구현 방식을 사용하며 같은 설계 승인을 반복하지 않는다.
서로 겹치지 않는 스택·역사·bundle 파일은 담당자를 나누고 통합·Git·최종 판정은 현재 agent가 맡는다.
검수한 변경·유지 테스트를 잠근 후 구현한다. 테스트 계약 오류는 근거를 확인해 정정한다.

| 순서·요구 | 정상·실패·경계 사례와 판정 | 검사 |
|---|---|---|
| 스택 자산과 직접 소비자 | CI6개 명령 불변, 기존 조합과 잘못된 역할·경로 거부 | stack-templates·new-repo·repo-sync |
| Spring·Vue 로컬 검사 | 기본 조합·단독·경로 지정, 실패 순서·PASS 억제, 링크·덮어쓰기 거부 | local-setup |
| 역사 읽기 이전 | 고정 원문과 다이제스트 일치, 누락·불일치 실패, 현재 판정 유지 | history-blob·기존 역사 검사 |
| source-only와 기존 bundle | catalog 없는 기록 SHA, builder 미호출, 원자적 출력·실패 정리 | release-bundle |
| 안내와 현재 상태 | 자연스러운 문장·정본 발견·참조·199줄, 구현과 전달 구분 | Markdown 검사·실제 읽기 경로 |
| 통합 후보 | 위 계약과 가드·시크릿·설정 전체 회귀, 테스트 약화·권한 누락 반증 | quality 전체·독립 읽기 전용 검토 |

각 검사는 변경한 작업공간의 실제 파일을 대상으로 하며 최초 실패·명령·결과를 보존한다.
HEAD만으로 미커밋 파일을 검증했다고 말하지 않고 diff와 대상 파일의 fingerprint를 함께 확인한다.
실제 서버·DB·운영 배포는 Harness에 없어 비적용이다. 소비 원격과 모델 실행은 승인 범위 밖이다.

## 진행과 최초 재현

- 로컬 기존 검사8개·스택11묶음·repo-sync43개는 시작 후보에서 통과했다.
  새 선택은 기존 parser의 usage 오류, 새 정본은 기존 경로에 묶인 catalog·reader 때문에 실패했다.
- bundle 기존 계약13개는 통과했고 source-only는 미지원 인수로 exit2였다.
  시험 초안의 package 이름·Bash3 배열 오류는 원문 기준으로 정정한 뒤 계약을 검수했다.
- 역사 reader의 기존7검사는 통과했다. 과거 결정 파일이 없을 때 현재 필수 결정 추적은 실패했다.
  삭제 후보는 시작 Git blob과 bytes·SHA256이 같은지 확인한 후 읽기 경로와 함께 이전한다.
- 문서 초안의 evidence 수량8개는 실제 원본7개로 정정했다. 삭제 범위를 늘리지 않았다.
- 병합·발행·설치와 소비 원격 작업은 이번 승인 범위에 없으며 실행하지 않는다.

```harness-doc-sync
{
  "version": 1,
  "documents": [
    {"path": "docs/specs/structure-cleanup.md", "reason": "승인 범위와 현재 후보의 결과 대조"},
    {"path": "README.md", "reason": "현재 소스 버전과 디렉터리 안내"},
    {"path": "docs/repository-structure.md", "reason": "정본·직접 소비자·수정 경로"},
    {"path": "docs/local-development.md", "reason": "개별 로컬 검사와 기존 명령 호환"},
    {"path": "docs/harness-maintenance.md", "reason": "source-only와 실험 발행 경계"},
    {"path": "docs/history-evidence.md", "reason": "삭제한 원문·복구·보존 조건"},
    {"path": "docs/decisions.md", "reason": "현재 구조 결정과 과거 결정 연결"},
    {"path": "docs/stack-guide.md", "reason": "현재 rule 원문 위치"},
    {"path": "docs/onboarding.md", "reason": "개별 스택 선택 안내"},
    {"path": "docs/quick-start.md", "reason": "발행 준비 기본 예시"},
    {"path": "experiments/split-packaging/README.md", "reason": "기존 실험 출력 유지"}
  ],
  "items": []
}
```

## 구현·검증 현황

스택 정본 27파일을 옮기고 카탈로그 schema3의 저장소 루트 경로로 셋업·생성·repo-sync를 연결했다.
CI6개의 배너 외 원문과 12조합을 보존했다. 로컬 검사는 Spring·Vue 단독·조합·무옵션 호환을 제공한다.
과거30파일은 고정 Git으로 옮겼고 decisions 원문2개는 현재 안내로 축약했다. 원문32개의 digest를
대조했으며 현재 trust/provenance와 외부 JSON7개는 바이트 그대로다. 인수 실패·보류 조건을 유지했다.
source-only를 추가하고 기존 네 staged package 출력을 유지했다. 빈 로컬 src 디렉터리4개만 rmdir했다.
사용자 자료·지도·복구 백업은 보존했다. 소스0.90.0 준비이며 병합·발행·설치는 미실행이다.

범위 검사: 로컬13, 스택12묶음, 신규 셋업39, repo-sync44와 역사 reader·기존 역사7검사가 통과했다.
bundle32검사는 최초 구현 후보에서 통과했으나 커밋 뒤 전체 quality51단계에서 정적 marker를
테스트 소스 자체가 포함해 오염으로 오판했다. 버전·SHA·digest는 정상이었다. archive의 실제 builder
원문을 고정 Git과 대조하도록 판정자를 보완했다. 전체 byte·checksum·dirty 거부 단언과 bundle32검사가 통과했다.
빈 줄 경고는 개별 명령의 구분자를 생성기로 옮겨 없앴고 기존 checker 바이트 동일·로컬13검사를 확인했다.
첫 독립 검토는 진행 기록 누락과 quality31/73의 미확인 때문에 FAIL이었다. 중대 코드 지적은 없었다.
native loader59단계는 이전한 repo-sync 경로 안내의 옛 fixture digest로 실패했다.
변경 범위를 확인하고 해당 지문만 갱신했다. 원문 일치와 임의 변조 거부를 다시 확인했다.
최초 실패·교정·전체 실행 원문은 작업공간 `.runtime/structure-cleanup/`에 보존한다.

최종 전체 quality와 교정 후 독립 검토는 진행 중이다. 통과 전 완료로 판정하지 않는다.
quality는 macOS 로컬 재현이며 checkout·Ubuntu apt·pipx 설치만 현재 작업공간·rg·격리 ruff0.15.15로 대체한다.
실제 소비 앱 Gradle/npm/browser·원격 CI·발행·설치·Claude 인증/실모델은 미실행이다.
fixture 명령 경계·로컬 회귀와 실제 소비 실행·전달 결과를 구분한다.
