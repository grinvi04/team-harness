---
paths: ["**/*.java"]
---

# Java / Spring Boot 작업 규칙

## Clean Architecture 의존성 (절대 역전 금지)
- `domain` 패키지: 순수 Java만. `@Entity`, `@Service`, `@Component` 등 Spring/JPA 어노테이션 금지.
- `interfaces` / `infrastructure` → `application` → `domain` 방향으로만.
- Controller에서 Repository 직접 호출 금지. Entity를 Controller 응답으로 직접 반환 금지.

## 절대 금지 패턴
```java
System.out.println("...");        // ❌ → log.debug/info 사용 (@Slf4j)
return ResponseEntity.ok(entity); // ❌ → DTO.from(entity) 변환 후 반환
user.get().getName();             // ❌ → .orElseThrow(() -> new XxxNotFoundException(id))
```

## 테스트 레이어 선택
- Service 로직 → `@ExtendWith(MockitoExtension.class)` (Spring 컨텍스트 없음)
- Controller (HTTP 레이어) → `@WebMvcTest`
- Repository (JPA 쿼리) → `@DataJpaTest`
- `@SpringBootTest` 는 꼭 필요한 경우만 (전체 컨텍스트 = 수십 초)
