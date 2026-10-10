# 실제 스킬 실행 경로와 브랜치 정리 보고

2026-10-10 · 사용자 승인: 감사 대화와 Harness 대화의 작업 분담.
기준 후보 9df9118 · 범위는 감사 F1/F4의 현재 결함 수정·재발 방지 검증·커밋이다.
과거 사건의 원인이 이 결함이었다는 인과는 확인하지 않았다.

## 현재 요구와 경계

- 현재 읽은 스킬의 플러그인에서 스크립트를 실행한다. HOME checkout fallback은 제거한다.
- Claude 경로는 현재 스킬 경로와 일치하면 보존한다. Codex는 실제 제공된 절대 스킬 경로를 사용한다.
- 경로 누락·잘못된 경로·다른 설치본은 wrapper 실행 전에 거부한다.
- PR 병합과 로컬/원격 브랜치 정리를 구분하고 삭제 실패·미확인을 숨기지 않는다.
- 시험은 임시 Git 저장소·작업공간만 사용한다. 사용자 브랜치와 변경은 보존한다.
- 플랫폼 로딩·권한 기능은 위임하고 Harness는 실행 경로의 결과 검증을 연결한다.
- 소비 원격·배포·결제와 Claude 인증 갱신·실제 모델 검증은 제외한다.
- 감사 대화의 요구 유지·반복 억제·완료 판정 개선은 이 작업에 중복하지 않는다.

## 재현과 수용 기준

기존 loop snippet은 경로 변수가 없을 때 격리 HOME의 오래된 스크립트를 실행했다.
기존 feature-merge snippet은 다른 worktree의 사용 때문에 실제 branch 삭제가 거부되어도 exit 0이었다.
두 재현은 당시 원본 9df9118 기준이며 실제 사용자 저장소의 삭제 시험은 아니다.

필수 검증: 공용·Codex 스킬의 현재 root 선택, 올바른 Claude root 유지, 누락·상대·다른 root 거부,
격리 Git 삭제 실패의 가시적 보고와 브랜치 보존, 삭제 성공 확인, 원격 조회 실패의 미확인 보고.
기존 loop·PR merge·package runtime binding·스킬 발견 검사와 CI에 재발 방지 시험을 연결한다.

## 현재 상태

구현: 0.85.0 후보의 경로 검증 계약·resolver·스킬 경로와 정리 보고 수정.
검증·독립 리뷰·커밋·PR·병합·릴리즈·설치는 각각 실제 결과가 확인된 뒤 기록한다.
실제 설치는 이전 완료 상태 0.84.0이며 이 후보 설치를 주장하지 않는다.

## 로컬 검증과 독립 리뷰

- 구현 커밋 cacf147과 후속 7파일 보완: 상대 root 환경값 거부, release 호출별 직접 root 사용,
  ancestry exit1과 조회 오류 구분, 분리 package reader 경로 보완.
- 실제 격리 회귀 시험6개 통과: `node --test tests/skill-path-cleanup-test.mjs`.
- 기존 loop30, PR merge58, flagship53, Codex skill mapping, package build20와 workflow binding3 통과.
- artifact integrity 최초 실행은 sandbox가 실제 변형·복구 쓰기를 거부했으므로 출력 PASS를 채택하지 않았다.
  승인된 동일 격리 작업공간 재실행은 변형·HEAD 원본 조립·복구6개를 실제 통과했다.
- Markdown302개·관련 구문·diff 검사 통과. 패키지 검사는 기록된 후보를 조립한다.
- 독립 Astra/medium read-only 첫 리뷰 P2 3건은 현재 코드와 반례 시험으로 해결했다.
  후속 리뷰는 추가 지적 없음. 관련 읽기 전용 실행4개와 reader 변환을 직접 확인했다.
  review 대상은 cacf147 + 후속7파일, diff SHA-256 e28b65b97474ce8ab2b0b67b3cf7df0688c44ce26f60bc9cbd953a8c7216b489다.
- 독립 sandbox의 Git/임시파일 쓰기 거부를 관찰했다. reviewer의 Git fixture·package 조립은 미실행이며
  구현자의 격리 실행과 구분한다. 테스트 통과가 모든 LLM 호출의 경로 준수를 보장하지 않는다.
- 현재 후보의 PR CI·병합·정식 릴리즈·실제 설치는 아직 미확인/미실행이다. 설치0.84.0과 후보0.85.0을 구분한다.

### PR #515 첫 CI 실패와 후속 수정

후보2cc5765의 quality는 기존 pr-create 리뷰 흐름 fixture가 새 경로 검증 전제를 누락해 실패했다.
실제 runtime-path 문서의 검증 블록을 fixture에 연결하며 reply/resolve/head 결박 판정은 유지한다.
필수 다른4개는 통과했고 병합은 멈췄다. 후속 후보의 CI 결과로 이 기록을 연결한다.

후보538890e의 첫 fixture 보완은 통과했으나 스킬 발견 검사에서 공용 root 안내 파일을 폴더로 오인했다.
디렉터리 경로 추출만 교정하고 모든 실제 스킬의 대문자 SKILL.md 필수 검사·frontmatter 검사는 유지한다.
