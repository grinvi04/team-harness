# 스택 프로필 변경의 현재 문서 범위

명세·코드·현재 사용 안내와 rule 배치의 직접 소비 경로를 대조한다.
검사기는 선언된 경로/상태만 확인한다. 의미와 대상 누락은 독립 검토에서 확인한다.

```harness-doc-sync
{
  "version": 1,
  "documents": [
    {
      "path": "README.md",
      "reason": "현재 스택 선택·버전/CI·상태·소비 안내의 일관성"
    },
    {
      "path": "docs/specs/stack-profiles-version-contract.md",
      "reason": "현재 스택 선택·버전/CI·상태·소비 안내의 일관성"
    },
    {
      "path": "docs/specs/stack-profiles-implementation-plan.md",
      "reason": "현재 스택 선택·버전/CI·상태·소비 안내의 일관성"
    },
    {
      "path": "docs/specs/stack-profiles-document-sync.md",
      "reason": "현재 스택 선택·버전/CI·상태·소비 안내의 일관성"
    },
    {
      "path": "docs/repository-structure.md",
      "reason": "현재 스택 선택·버전/CI·상태·소비 안내의 일관성"
    },
    {
      "path": "docs/local-development.md",
      "reason": "현재 스택 선택·버전/CI·상태·소비 안내의 일관성"
    },
    {
      "path": "docs/stack-guide.md",
      "reason": "현재 스택 선택·버전/CI·상태·소비 안내의 일관성"
    },
    {
      "path": "docs/stack-versions.md",
      "reason": "현재 스택 선택·버전/CI·상태·소비 안내의 일관성"
    },
    {
      "path": "docs/stack-troubleshooting-frontend.md",
      "reason": "현재 스택 선택·버전/CI·상태·소비 안내의 일관성"
    },
    {
      "path": "docs/stack-troubleshooting-backend.md",
      "reason": "현재 스택 선택·버전/CI·상태·소비 안내의 일관성"
    },
    {
      "path": "docs/clean-architecture.md",
      "reason": "현재 스택 선택·버전/CI·상태·소비 안내의 일관성"
    },
    {
      "path": "docs/standards-scope.md",
      "reason": "현재 스택 선택·버전/CI·상태·소비 안내의 일관성"
    },
    {
      "path": "docs/decisions.md",
      "reason": "현재 스택 선택·버전/CI·상태·소비 안내의 일관성"
    },
    {
      "path": "docs/onboarding.md",
      "reason": "현재 스택 선택·버전/CI·상태·소비 안내의 일관성"
    },
    {
      "path": "docs/harness-maintenance.md",
      "reason": "현재 스택 선택·버전/CI·상태·소비 안내의 일관성"
    },
    {
      "path": "plugins/harness-guard/skills/repo-sync/SKILL.md",
      "reason": "현재 스택 선택·버전/CI·상태·소비 안내의 일관성"
    },
    {
      "path": "templates/rules/typescript.md",
      "reason": "선택 스택의 공식 링크·조건부 실무 기준·읽기 경로"
    },
    {
      "path": "templates/stacks/spring-boot/rules/java.md",
      "reason": "선택 스택의 공식 링크·조건부 실무 기준·읽기 경로"
    },
    {
      "path": "templates/stacks/spring-boot/rules/flyway.md",
      "reason": "선택 스택의 공식 링크·조건부 실무 기준·읽기 경로"
    },
    {
      "path": "templates/stacks/python/rules/python.md",
      "reason": "선택 스택의 공식 링크·조건부 실무 기준·읽기 경로"
    },
    {
      "path": "templates/stacks/python/rules/alembic.md",
      "reason": "선택 스택의 공식 링크·조건부 실무 기준·읽기 경로"
    },
    {
      "path": "templates/stacks/rails/rules/ruby.md",
      "reason": "선택 스택의 공식 링크·조건부 실무 기준·읽기 경로"
    },
    {
      "path": "templates/stacks/nextjs/rules/nextjs.md",
      "reason": "선택 스택의 공식 링크·조건부 실무 기준·읽기 경로"
    },
    {
      "path": "templates/stacks/vue/rules/vue.md",
      "reason": "선택 스택의 공식 링크·조건부 실무 기준·읽기 경로"
    },
    {
      "path": "templates/stacks/node/rules/prisma.md",
      "reason": "선택 스택의 공식 링크·조건부 실무 기준·읽기 경로"
    },
    {
      "path": "templates/stacks/react/rules/react.md",
      "reason": "선택 스택의 공식 링크·조건부 실무 기준·읽기 경로"
    },
    {
      "path": "templates/stacks/nuxt/rules/nuxt.md",
      "reason": "선택 스택의 공식 링크·조건부 실무 기준·읽기 경로"
    },
    {
      "path": "templates/stacks/python/frameworks/django/rules/django.md",
      "reason": "선택 스택의 공식 링크·조건부 실무 기준·읽기 경로"
    },
    {
      "path": "templates/stacks/python/frameworks/fastapi/rules/fastapi.md",
      "reason": "선택 스택의 공식 링크·조건부 실무 기준·읽기 경로"
    },
    {
      "path": "templates/stacks/python/frameworks/flask/rules/flask.md",
      "reason": "선택 스택의 공식 링크·조건부 실무 기준·읽기 경로"
    },
    {
      "path": "templates/stacks/rails/ui/hotwire/rules/hotwire.md",
      "reason": "선택 스택의 공식 링크·조건부 실무 기준·읽기 경로"
    },
    {
      "path": "templates/stacks/rails/ui/inertia-react/rules/inertia-react.md",
      "reason": "선택 스택의 공식 링크·조건부 실무 기준·읽기 경로"
    },
    {
      "path": "templates/stacks/rails/ui/inertia-vue/rules/inertia-vue.md",
      "reason": "선택 스택의 공식 링크·조건부 실무 기준·읽기 경로"
    },
    {
      "path": "templates/stacks/rails/ui/api/rules/api.md",
      "reason": "선택 스택의 공식 링크·조건부 실무 기준·읽기 경로"
    },
    {
      "path": "docs/specs/structure-cleanup.md",
      "reason": "기존 구조/로컬 셋업 명세의 Spring Boot 현재 경로 연결"
    },
    {
      "path": "docs/specs/local-spring-vue-setup.md",
      "reason": "기존 구조/로컬 셋업 명세의 Spring Boot 현재 경로 연결"
    }
  ],
  "items": []
}
```
