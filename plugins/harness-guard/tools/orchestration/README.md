# Team Harness 개발 조정 도구

Team Harness의 선택형 `ao-coordinate` workflow에서 사용하는 선언 검사기와 작업 기록 틀이다. 현재 소스는 `team-harness/plugins/harness-guard/tools/orchestration` 한 곳에서 관리한다. 별도 agent profile·skill 설치기는 제공하지 않는다.

- [사용 안내](docs/usage.md): Node.js 22+, 선택형 로컬 설치, CLI/API와 한계
- [조정 절차](docs/coordination-workflow.md): 요청 → 필요한 역할 → 인계 → 검사 → 인수
- [역할 계약](docs/role-contracts.md) / [아키텍처](docs/architecture.md)
- [통합 범위](docs/product-direction.md) / [이관 이력](docs/history.md)

`npm ci --ignore-scripts`, `npm test`, `npm run check`로 이 패키지를 검증한다. 기본 조정 절차는 npm 설치 없이도 사용한다. 구조화된 선언 검사가 필요한 프로젝트만 검증된 tgz를 개발 의존성으로 고정한다. npm registry에 공개된 패키지라는 뜻은 아니다.
