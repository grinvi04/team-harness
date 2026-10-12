# 초기 표준과 거버넌스 하드닝 결정

[현재 결정 목록](decisions.md)과 함께 읽는다. 이 문서는 현재 읽기 경로를 안내한다.
2026-06~07 당시 후보·반증·대체 관계의 전체 기록은
[고정 Git 원문](https://github.com/grinvi04/team-harness/blob/54657b3ef79ab36c3e0877664964356badd3510b/docs/decisions-foundation-and-hardening.md)에 보존한다.
역사상 PASS나 폐기된 설계는 현재 후보의 동작·권한·완료 증거가 아니다.

## 현재 유지하는 결정과 정본

- 개발 구성과 GitHub 정책·증거 연결은 Harness가 소유하고 플랫폼 실행은 native에 위임한다.
  현재 범위는 [제품 방향](product-direction.md), 기술 선택의 적용 조건은 [표준 적용 기준](standards-scope.md)이다.
- 규약은 AGENTS.md, 공유 표준은 docs, 확정 결정은 decisions, 백로그는 GitHub Issues,
  구현 계획은 specs, 실행 로그는 Git 히스토리에 둔다. [협업 계약](ai-collaboration.md)을 따른다.
- 플러그인 버전 배포와 소비 repo 선택 도입을 구분한다. 파일 복사·전역 설정 변경으로
  자동 전파했다고 주장하지 않는다. [유지보수](harness-maintenance.md)가 현재 정본이다.
- main/develop 보호, 필수 CI와 서버 정책을 유지한다. 솔로·팀 승인 조건, Conventional Commits,
  PR wrapper·자동머지·복구 조건은 [코드 리뷰](code-review.md)를 따른다.
  솔로 조건을 팀 승인 우회 근거로 사용하지 않는다.
- feature의 선행 스펙, guard의 보호 브랜치·검증기 삭제·전역 설치 차단과 fail-closed 경계를 유지한다.
  [.harness-lite 적용 조건](harness-plugin.md)도 다른 repo나 다른 게이트의 면제가 아니다.
- 셸·프로파일·주석 입력의 정적 분류는 확인한 문법 범위만 보장한다. 과거 오탐·누락의 수정과
  판정 철학 정정은 원문에서 당시 후보별로 읽으며 모든 의미를 판정한다고 확대하지 않는다.
- 모델·역할은 플랫폼과 승인된 설정을 따른다. 현재 [모델 운영](model-tiering.md)이 과거 티어링
  훅·강제 기본값보다 우선한다. 전역 설정이나 비용·권한을 자동 확대하지 않는다.

## 원문 복구

삭제·축약 전 바이트의 SHA-256은
`fbfe7fbd3da8e228b01387b0de2c7497fb17b244a33cebc3773ab079243838f0`이다.
저장소 전체 Git 이력이 있는 checkout에서 아래 명령으로 별도 파일에 복구할 수 있다.

```bash
git --no-replace-objects show \
  54657b3ef79ab36c3e0877664964356badd3510b:docs/decisions-foundation-and-hardening.md \
  > /tmp/decisions-foundation-and-hardening.md
shasum -a 256 /tmp/decisions-foundation-and-hardening.md
```

원문이 없거나 digest가 다르면 복구·검증 성공으로 판정하지 않는다.
현재 계약은 위 정본에서 읽고 과거 결정을 찾을 때 고정 원문을 사용한다.
