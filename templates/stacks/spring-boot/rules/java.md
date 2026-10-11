---
paths: ["**/*.java"]
---

# Java / Spring Boot 작업 규칙

프로젝트가 선택한 JDK·Spring·ORM 버전과 구조를 따른다. 공통 적용 기준은 `docs/standards-scope.md`다.
경로는 소비 repo에서 조회하는 Team Harness 문서 이름이다. 로컬 복사 여부를 먼저 확인한다.

## 검사 연결

포맷 도구는 Spotless/google-java-format 등 프로젝트에서 선택한 것을 사용한다.
설치한 버전에 맞춰 실제 빌드와 CI에 연결한다. 의미 규칙과 포맷 규칙을 중복해 충돌시키지 않는다.
공식 설정은 [Spotless](https://github.com/diffplug/spotless/tree/main/plugin-gradle)를 따른다.
`./gradlew spotlessApply`·`./gradlew check`는 해당 태스크가 있는 repo의 예시다.

## 코드와 데이터 경계

- 선택한 계층의 의존 방향을 유지한다. JPA 어노테이션 허용은 프로젝트의 결정이다.
- 엔티티를 외부 응답으로 직접 노출하지 않는다. 계약에 맞는 DTO로 변환한다.
- Optional은 부재를 처리한다. 진단 로그는 프로젝트 로깅을 사용한다.
- 직접 SQL은 바인딩하고, ORM 필터 밖의 권한·삭제 경로를 별도로 확인한다.

## 자주 확인할 문제

- Spring 기본 400 응답을 포괄 핸들러가 500으로 바꾸지 않는지 실제 요청으로 확인한다.
- 낙관적 잠금을 쓰면 성공 커밋의 version과 다음 수정 요청을 검사한다.
- 소프트 삭제를 쓰면 필터 종류·버전·모델·직접 SQL의 적용 범위를 검사한다.
- mock만으로 DB 방언·제약·트랜잭션 결과를 보장하지 않는다.

자세한 진단과 공식 자료는 `docs/stack-troubleshooting-backend.md`를 따른다.
단위·HTTP·JPA slice·전체 통합 테스트 중 변경 경계에 맞는 것을 선택한다.
아키텍처 검사나 Testcontainers는 프로젝트에 실제 연결한 경우에만 검사 결과로 보고한다.
