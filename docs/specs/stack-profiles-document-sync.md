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
    },
    {
      "path": "CHANGELOG.md",
      "reason": "소스 후보0.91.0 재현 인덱스"
    },
    {
      "path": "docs/changelog/2026/v0.91.0.md",
      "reason": "실제 구현 커밋의 후보 변경 이력"
    },
    {
      "path": "docs/changelog/releases.md",
      "reason": "소스 후보를 연결하는 생성 인덱스"
    }
  ],
  "items": []
}
```

## 0.91.0 전달

2026-10-12 사용자가 최종 확인·PR·병합·발행·설치를 별도로 요청했다.
현재 전달 원본은 [기능 PR532](https://github.com/grinvi04/team-harness/pull/532),
[0.91.0 발행 원본](https://github.com/grinvi04/team-harness/releases/tag/v0.91.0)과 프로젝트 지도다.
링크 자체가 병합·발행·설치 성공 증거는 아니다. GitHub 상태·정확한 SHA·실제 설치 파일을 단계별 확인한다.
구현 당시의 미실행/보류 기록은 당시 범위이며 새로운 전달 승인과 구분한다.

88cfd3b 최종 독립 검토는 기능/안전 FAIL, Important5개였다. PR 첫quality도 Linux venv 링크 탐색으로 실패했다.
Nuxt getter/환경 module, Gemfile Ruby 조건, Python 설치 입력, Hotwire CDN/Node 경계와 Python Alembic gate를 보완했다.
생성 venv/정규 pyvenv.cfg만 Flyway 탐색에서 제외하며 소스·링크 거부는 유지한다. 최초 실행·지적·RED 원문을 보존한다.
Python은 DB 제품을 정하지 않는다. Alembic job은 설정 부재만 self-skip하며 사용 중이면 필수·exact runtime·기록 검사다.
사용자 Alembic CI가 다르면 첫 쓰기 전에 보존·중단한다. 두 manifest·README는 계속0.91.0이다.
08d2d2c 보완 검토는 보안 PASS_SCOPED, 기능 FAIL이었다. Nuxt 따옴표 getter/setter 반례를 추가로 거부한다.
현재 후보의 독립 보완 검토·required CI·live provenance·bundle/checksum을 통과한 뒤 Git 단계와 설치를 수행한다.
실제 서버·DB가 없는 저장소의 health/DB만 비적용이다. 소비 앱·원격 작업·배포·결제와 Claude 인증/실모델 검증은 제외·보류한다.

### 릴리즈 준비 확인

PR532는 develop에 병합됐다. f9a7f44에서 새quality73/73·독립 보안 PASS_SCOPED·live7/7·bundle/checksum을 확인해 GO로 판정했다.
[main PR533](https://github.com/grinvi04/team-harness/pull/533)의 처음 커밋 검사는 develop 제외 후 빈 범위를 거부했다. 이 준비 기록 커밋을 별도로 검사한다.
현재 지도는 주 작업폴더의 `.project-map/index.html`과 `state.json`에 있으며 로컬 자료라 GitHub 파일로 공개하지 않는다.
최종 PR head의 CI·리뷰 게이트를 다시 대조한 뒤 main 병합·태그·역병합·실제 설치를 확인한다. 위 GO는 그 단계들의 완료가 아니다.
