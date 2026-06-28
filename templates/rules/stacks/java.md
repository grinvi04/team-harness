---
paths: ["**/*.java"]
---

# Java / Spring Boot 작업 규칙

## 포맷은 Spotless + google-java-format이 강제 (prose 아님)
- 코드 포맷은 의견이 아니라 **빌드 게이트**다. `spotlessCheck`가 `check`에 연결돼 CI가 어긋난 포맷을 차단한다.
- 자동수정: `./gradlew spotlessApply` (커밋 전에 돌리면 끝 — 포맷을 손으로 맞추지 말 것).
- checkstyle은 **의미 규칙만**(UnusedImports·NeedBraces·EmptyBlock·MagicNumber). **공백·들여쓰기·줄바꿈은 google-java-format이 소유** — checkstyle에 공백 규칙을 넣지 말 것(충돌).
- `build.gradle`에 넣을 블록 (검증 설정 예시):

```gradle
plugins {
    // ...
    id 'checkstyle'
    id 'com.diffplug.spotless' version '6.25.0'
}

checkstyle {
    toolVersion = '10.21.1'
    configFile = file('config/checkstyle/checkstyle.xml')
    maxWarnings = 0
}

// Google Java Style — spotlessApply 자동수정, spotlessCheck는 check에 연결돼 CI가 강제.
spotless {
    java {
        target 'src/**/*.java'
        googleJavaFormat('1.22.0')
        removeUnusedImports()
        trimTrailingWhitespace()
        endWithNewline()
    }
}
```

> `checkstyle.xml`은 `templates/checkstyle.xml`을 `backend/config/checkstyle/`에 복사해 쓴다.

## Clean Architecture 의존성 (절대 역전 금지)
- `domain` 패키지: 순수 Java만. `@Entity`, `@Service`, `@Component` 등 Spring/JPA 어노테이션 금지.
- `adapter` → `application` → `domain` 방향으로만 (모듈 내부 계층 = adapter → application → domain,
  interface/infrastructure를 별도 계층으로 분리하지 않음 — 단일 출처: `clean-architecture.md`·`decisions.md`).
- Controller에서 Repository 직접 호출 금지. Entity를 Controller 응답으로 직접 반환 금지.

## 절대 금지 패턴
```java
System.out.println("...");        // ❌ → log.debug/info 사용 (@Slf4j)
return ResponseEntity.ok(entity); // ❌ → DTO.from(entity) 변환 후 반환
user.get().getName();             // ❌ → .orElseThrow(() -> new XxxNotFoundException(id))
```

## 운영 정합성 함정 (단일 출처: 표준 문서)
- **소프트삭제**: `@SQLRestriction`은 `@MappedSuperclass`에서 **상속되지 않음** — 베이스에만 달면 하위
  엔티티에 적용 안 돼 삭제 데이터가 노출. 엔티티별 적용 + 삭제 후 제외 테스트 (`docs/db-standards.md`).
- **낙관적 잠금**: update 응답 DTO는 **flush 후**(또는 재조회) 매핑 — flush 전이면 `@Version` 증가
  미반영, stale version으로 거짓 409 (`docs/api-standards.md`).
- **입력 오류 400**: `HttpMessageNotReadableException`·`MethodArgumentTypeMismatchException`·
  `ConstraintViolationException` 등을 전역 핸들러에서 400으로 매핑 — 미매핑 시 500 흡수 (`docs/api-standards.md`).

## 테스트 레이어 선택
- Service 로직 → `@ExtendWith(MockitoExtension.class)` (Spring 컨텍스트 없음)
- Controller (HTTP 레이어) → `@WebMvcTest`
- Repository (JPA 쿼리) → `@DataJpaTest`
- `@SpringBootTest` 는 꼭 필요한 경우만 (전체 컨텍스트 = 수십 초)
