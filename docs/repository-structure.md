# 저장소를 수정할 때 읽는 안내

Team Harness는 앱 코드가 아니라 개발 기준·설정·검사 연결을 제공한다.
먼저 아래 표에서 수정할 정본을 찾는다. 같은 이름이라도 사용하는 대상이 다를 수 있다.

| 영역 | 수정할 정본 | 사용하는 곳 |
|---|---|---|
| 가드·PR·복구·스킬 | `plugins/harness-guard/` | 설치되는 공개 플러그인 하나 |
| 팀 기술 기준 | `docs/`의 현재 안내 | 소비 프로젝트가 선택해서 적용 |
| 소비 프로젝트 기본 설정 | `templates/settings.json` | 새 프로젝트의 `.claude/settings.json` |
| 이 저장소의 도구 설정 | `.claude/settings.json` | Team Harness 소스 개발용; 설치 선언을 넣지 않음 |
| Git/CI 공통 정책 | `templates/githooks/commit-msg`, `templates/ci/{commitlint,test-guard}.yml` | 소비 프로젝트와 이 저장소의 배치 사본 |
| 스택 선택과 검사 이름 | `templates/stacks.json` | `new-repo.sh`와 CI 템플릿 생성기 |
| 스택 CI 명령 | `templates/ci/stacks/sources/` | 기존 8개 완성 CI 템플릿 |
| 분리 패키지 평가 | `experiments/split-packaging/` | 격리된 실험; 공개 설치 경로와 구분 |
| 과거 후보의 실행 증거 | `docs/history/harness-modernization/` | 당시 결과·실패·보류를 확인할 때 |

## 정본과 배치 파일

GitHub Actions는 `.github/workflows/`를, Git은 `.githooks/`를 직접 읽는다.
필수 위치의 파일을 유지하며, 동일한 템플릿을 다음 명령으로 반영한다.

```bash
node scripts/sync-repository-config.mjs --write
node scripts/sync-repository-config.mjs --check
```

이 명령은 표에 적힌 세 배치 사본의 내용과 실행 권한만 관리한다.
다른 workflow와 이 저장소의 설정은 각각 목적이 있으므로 합치지 않는다.
Codex 스킬 wrapper는 공통 스킬을 연결하는 공식 진입점이다. 공통 내용을 wrapper에 복사하지 않는다.

## 스택 템플릿을 바꿀 때

카탈로그는 기존 8개 선택의 CI 파일·rule·필수 검사·DB 연결을 한곳에서 관리한다.
공통 workflow와 시크릿 검사는 `sources/common/`, 작업 명령은 `sources/jobs/`에서 수정한다.
완성 `ci-gate-*.yml`은 복사 가능한 생성물이다. 직접 편집하면 CI가 불일치를 거부한다.

```bash
node scripts/generate-stack-templates.mjs --write
node scripts/generate-stack-templates.mjs --check
bash tests/stack-templates-test.sh
bash tests/new-repo-test.sh
```

NestJS·Spring 풀스택을 고르면 프론트엔드를 `node`(React/Vite), `vue`, `nextjs`에서 선택한다.
비워 두면 기존 Node 프론트엔드 검사를 사용한다. Vue/Next.js 선택은 해당 rule을 함께 복사한다.
이 선택이 앱이나 패키지 설정을 생성하지는 않는다. 이미 사용하는 검사 명령에 맞춰 소비 CI를 조정한다.
Prisma/Flyway/Alembic는 기존 프리셋 연결이며 DB 제품이나 운영 자격증명을 강제하지 않는다.

셋업은 기존 CI·설정·rule을 덮어쓰지 않는다. 스택 선택이 실행기 자동 허용을 추가하지도 않는다.
빈 권한 fragment는 제거했다. 별도 사용자 fragment가 필요한 경우에만
`scripts/merge-permissions.mjs --fragments <dir>`를 명시하며, 승인 범위는 사용자 정책을 따른다.

## 실험과 과거 기록

분리 패키지의 staged 버전은 공개 플러그인 버전과 다르다.
`installable: false`와 [#412](https://github.com/grinvi04/team-harness/issues/412)의 보류 조건을 유지한다.
명령·격리 조건은 [실험 안내](../experiments/split-packaging/README.md)를 읽는다.
이전 `scripts/build-packages.mjs` 등의 진입점은 같은 구현을 호출하는 호환 경로다.

역사 폴더의 후보 SHA·실행 결과·해시는 당시 기록이다. 현재 상태로 다시 쓰지 않는다.
현재 작업의 범위·검증은 [구조 정리 스펙](specs/structure-maintenance.md)에서 확인한다.
기존 스펙과 현재 안내의 링크도 새 역사 경로를 가리킨다.

## 검증과 전달

quality CI는 생성물 일치와 기존 가드·설정·패키지·문서 검사를 모두 수행한다.
템플릿 회귀 시험은 정리 시작 후보의 원문을 기준으로 기존 명령과 보호 설정을 대조한다.
향후 의도적으로 동작을 바꿀 때는 변경 이유·새 기대값·거부 사례를 함께 검토한다.
로컬 검사 통과, PR 병합, 릴리즈 발행, 실제 설치는 각각 별도 단계다.
