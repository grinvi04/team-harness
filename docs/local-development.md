# 로컬 Spring Boot+Vue 검사 연결

준비된 프로젝트에 공통 검사 진입점 하나를 추가한다. 프로젝트마다 검사 순서와 경로 처리를 다시 쓰는
일을 줄이는 첫 구성이다. GitHub 계정·원격 저장소·회사 공통 기준은 필요하지 않다.
앱 생성이나 검사 도구의 설정까지 자동화하지는 않는다.

## 준비 조건

- Team Harness checkout과 Node.js 22+, Bash. 실제 검사에는 제품이 요구하는 JDK·npm과 의존성 다운로드가 필요하다.
- `backend/gradlew` 실행 파일, `backend/build.gradle` 또는 `build.gradle.kts`가 있는 Spring Boot 앱.
- `frontend/package.json`과 `package-lock.json`, Vue와 `@playwright/test` 의존성.
- frontend scripts에 `type-check`, `lint`, `test:unit`, `build`, `test:e2e`가 모두 설정되어 있어야 한다.

새 프로젝트는 Spring Boot와 Vue 앱을 먼저 생성하고 위 검사를 연결한다. 기존 프로젝트도 같은 조건을
확인한다. 부족한 항목은 도구가 오류로 알리며 빈 검사나 항상 성공하는 명령으로 채우지 않는다.
Java 검사 연결은 [Java 기준](../templates/rules/stacks/java.md), Vue 타입·lint·단위 검사는
[Vue 기준](../templates/rules/stacks/vue.md), 브라우저·접근성 범위는
[프론트 검증 기준](frontend-design-standards.md#8-검증-pr-전-프레임워크-무관)을 재사용한다.

## 적용과 실행

```bash
# 기본은 미리보기: 파일 생성·제품 명령 실행·네트워크 호출 없음
node /path/to/team-harness/scripts/setup-local.mjs --project "/path/to/my-project"

# 표시한 scripts/check-harness.sh 하나만 생성
node /path/to/team-harness/scripts/setup-local.mjs --project "/path/to/my-project" --apply

# 내용을 확인한 뒤 실행. 어느 디렉터리에서 실행해도 제품 루트를 찾는다.
bash "/path/to/my-project/scripts/check-harness.sh"
```

실행 순서는 backend `./gradlew check bootJar` → frontend `npm ci` → 타입 검사 → lint → 단위 테스트 →
빌드 → 프로젝트 Playwright로 Chromium 준비 → E2E다. 어느 단계든 실패하면 즉시 멈추고 성공을 표시하지 않는다.
이 실행은 제품의 Gradle/npm 명령과 설치 스크립트를 실행하므로 자신이 검토·관리하는 프로젝트에서 사용한다.
생성 파일은 하네스 checkout 없이도 사용할 수 있고 이후 제품에서 관리한다.

기존 목적 파일은 내용이 같아도 덮어쓰지 않는다. 재적용이나 업데이트는 생성 원본과 제품 파일을 검토해
필요한 차이만 직접 반영한다. scripts가 링크이거나 목적 파일이 이미 있으면 중단한다.
AGENTS.md·기존 check-local.sh·앱 설정·데이터·Git 설정은 적용 과정에서 수정하지 않는다.

## 제품에 남길 내용과 한계

제품 AGENTS.md의 검사 명령에 새 진입점을 연결하고 기존 제품 전용 검사도 유지한다. 이미 check-local.sh에
동일한 공통 단계가 있으면 두 파일을 연이어 실행해 중복 검사하지 말고 기존 진입점을 유지하거나 내용을 검토해
통합한다. 샘플의 DB 재시작 보존·E2E 이미지 복원처럼 앱에 필요한 처리는 이 공통 구성에 포함되지 않는다.
제품 E2E가 파일을 갱신하거나 서버를 실행하는지는 해당 제품 설정에서 확인한다.

준비 조건 검사는 파일·명령 선언의 존재를 확인한다. 검사 설정의 충실도·실제 통과·보안 격리를 증명하지 않는다.
변경한 코드는 해당 검사를 다시 실행하고, 동일 후보·환경·범위의 증거만 재사용한다.
다른 스택·패키지 관리자·폴더 구조·DB·인프라는 실제 요구가 생길 때 확장한다.
진행과 검증 결과는 [명세](specs/local-spring-vue-setup.md), 제품 우선순위는 [로드맵](product-direction.md)을 따른다.
