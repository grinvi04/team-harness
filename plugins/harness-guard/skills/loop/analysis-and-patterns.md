# Loop 분석과 사용 패턴

[상위 문서](SKILL.md)로 돌아간다. 아래는 원문의 해당 주제 본문을 순서대로 보존한 실행 계약이다. 상위 문서와 함께 적용한다.

## Phase 1 — 컨텍스트 분석 (`subagent_type: general-purpose`, `model: sonnet`, **foreground**)

**프롬프트:**
- 작업 목표: `$GOAL`
- 통과 기준 명령: `$EXIT_CMD`
- 현재 오류 출력 (Phase 0-3의 exit command 결과):

  ```
  <Phase 0-3 오류 출력 전체>
  ```

- AGENTS.md를 읽어 프로젝트 구조·디렉터리를 파악한다.
- 오류의 **근본 원인을 분류**하라:
  1. **유형**: (lint 위반 / 타입 에러 / 테스트 실패 / 빌드 오류 / 보안 취약점 / 기타)
  2. **범위**: 영향받는 파일 목록 (최대 20개 — 초과하면 "20개 초과, 파일 패턴으로 요약")
  3. **반복 추정**: 이 유형의 수정에 예상되는 반복 횟수 (근거 포함)
  4. **전략**: 반복당 처리할 수정 단위 (예: "파일 단위로 순서대로", "오류 유형별로 분류 후")
  5. **금지 사항**: 이 수정에서 건드리면 안 되는 파일/섹션 (테스트 파일, 마이그레이션 파일 등)
- 반환 형식: 위 1~5 항목을 명시.

오케스트레이터는 이 결과를 기록하고 Phase 2 반복 프롬프트에 포함한다.

---

## 사용 패턴 참고

### 패턴 A — CI 통과 루프

```bash
/loop "CI 실패 수정" "gh run watch $(gh run list --limit 1 --json databaseId -q '.[0].databaseId')" --max 3
```

> CI 완료까지 시간이 걸리므로 max를 낮게 유지한다.
> CI 실패 로그: `gh run view --log-failed`로 확인.

### 패턴 B — 정적 분석 클린업

```bash
/loop "모든 checkstyle 위반 수정" "cd backend && ./gradlew checkstyleMain" --max 10
/loop "ESLint 에러 수정" "cd frontend && npm run lint" --max 8
```

> 파일 수가 많으면 오류 유형별로 분류해 반복한다 — 에이전트가 자동으로 그룹화한다.

### 패턴 C — 의존성 취약점

```bash
/loop "npm 취약점 해소" "npm audit --audit-level=high" --max 5 --no-commit
```

> `--no-commit`: 의존성 변경이 연쇄 영향을 줄 수 있어 검토 후 수동 커밋.
> 루프 종료 후 `npm test`로 회귀를 확인한다.

### 패턴 D — 테스트 수정

```bash
/loop "실패 테스트 전부 통과" "cd backend && ./gradlew test" --max 7
```

> 테스트 파일 수정 금지 — 구현 코드만 수정한다.
> 테스트가 잘못 작성됐다고 판단되면 루프를 중단하고 `/feature-modify`로 처리한다.

---

## 이 커맨드를 쓰지 말아야 할 때

| 상황 | 대신 쓸 커맨드 |
|---|---|
| 신규 기능 구현 | `/feature-add` |
| 기존 기능 수정 | `/feature-modify` |
| 범위가 불명확한 작업 | `/plan`으로 먼저 정의 |
| 보안 취약점 패치 (운영 중단 수준) | `/hotfix` |
| 대규모 리팩터링 | `/plan` → `/feature-modify` |
