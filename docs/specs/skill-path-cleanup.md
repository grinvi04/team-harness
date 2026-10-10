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

## 최초 구현 상태 (2026-10-10)

구현: 0.85.0 후보의 경로 검증 계약·resolver·스킬 경로와 정리 보고 수정.
검증·독립 리뷰·커밋·PR·병합·릴리즈·설치는 각각 실제 결과가 확인된 뒤 기록한다.
실제 설치는 이전 완료 상태 0.84.0이며 이 후보 설치를 주장하지 않는다.

## 최초 로컬 검증과 독립 리뷰

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

후보2174fa0의 profile 설치 회귀: 공용 안내 링크에만 추가된 core 환경 placeholder가 미해소로 거부됐다.
분리 패키지는 같은 조립 폴더의 core 안내를 상대 링크로 읽도록 교정한다. 스크립트 binding 검사는 유지한다.
시험은 임시 filesystem profile만 사용하며 실제 사용자 cache·설정·공급 등록은 변경하지 않는다.

후속 로컬 결과: profile 수명주기74개, PR receiver37사례 포함9개, 신규 회귀6개, workflow binding3개 통과.
선언된 실행 인수의 중복 shell quoting은 조립 단계에서만 교정했고 placeholder 거부·doctor 판정은 유지했다.
독립 후속 리뷰의 시험 JSON→shell 인용 P2는 shell 단일 인용과 특수 문자 literal 시험으로 수정했다.
공용 안내는 활성/staged package 세 소비자의 실제 링크와 파일을 확인했다. disabled 안내 접근은 보장하지 않는다.

최종 후속 리뷰는 신규 시험의 다른 JSON→shell 치환2곳도 찾아냈다. 동일 shellQuote로 고치고
문서 초기화 블록의7개 특수 문자 literal 전달 반례를 추가했다. 첫 인용 보완이 불완전했던 결과를 보존한다.

후보e4df589의 공존 검사 실패는 공용 안내를 skills 루트에 둔 발견 계약 위반이었다.
안내를 plugin 루트 runtime-path.md로 이전하고 필수 reader·catalog·조립·시험 경로를 함께 옮겼다.
공존 검사기는 완화하지 않았다. 새 배치에서는 불필요해진 스킬 발견 검사 변경도 원래 계약으로 복구했다.

안내 이전 후보19e4e0f: 경로 회귀6, 발견19, workflow binding3, plugin 공존10, profile 수명주기74 통과.
공존·profile 시험은 현재 기록된 plugin source로 조립했고 실제 사용자 설정·cache는 수정하지 않았다.

후보de2d0d4의 native-loader 실패: 검토된 공용 스킬 변경10개가 현재 승인 원문 체크섬 fixture에 미반영됐다.
이전 manifest SHA-256 ffa6fd71a11fe4e601e662188fcd02870683f43ef5999e973b9f1852b2601f70는 당시 Git 후보에 보존한다.
변경된10개만 동기화하고 새 공용 안내·resolver도 고정한다. guard·hook·agent의 기존 hash는 유지한다.
격리 계약의 Codex 전용 내용 거부 검사도 새 두 공용 파일에 적용하며 Claude 인증·모델 시험은 하지 않는다.

현재 공용 source 체크섬28개·격리·기본 가드 거부 및 native-loader17개 wrapper 계약 검사가 통과했다.
고정 체크섬의 일치는 의미·품질 보장이 아니며 앞서 수행한 코드 리뷰·실행 검증과 구분한다.

## 0.85.0 릴리즈 점검 후속 (2026-10-11)

PR #515 최종 후보f7f9c80의 필수 CI5개 통과와 develop 병합c0b700c을 확인했다.
원격 작업 브랜치는 삭제됐다. 로컬 정리는 다른 worktree의 develop 사용으로 실패해 보존했다.
독립 보안 검토가 repo-sync의 실행 경로2곳 인용 누락을 발견해 발행을 멈췄다.
문서의 실제 명령을 추출한 공백 경로 반례는 수정 전 실패했다. 두 인수를 완전히 인용하고,
특수 문자6종의 Node/Bash 실제 전달 시험과 공용 source 체크섬을 함께 갱신한다.
읽기 전용 reviewer의 Git/Python 임시 캐시와 heredoc 쓰기 거부는 당시 미확인 기록으로 보존한다.
현재 후보의 CI·독립 검토를 통과한 뒤 릴리즈를 재개한다. 최신 원격 결과와 실제 설치 단계는
관련 PR과 프로젝트 .project-map/에서 관리한다. 아직 발행 전이며 실제 설치는0.84.0이다.

## 0.85.0 정식 릴리즈 준비 (2026-10-11)

후속 PR #516은 필수 CI5개 통과 후 develop 후보fb3fccd로 병합됐다.
release-check GO: 현재 diff36파일과 원문을 대조한 독립 품질·보안 검토 차단 없음,
실제 DB·마이그레이션·금액 계약 부재의 정당한 SKIP, 현재 HEAD package/bundle 체크섬 통과.
외부 원본7개 live 대조는 동일 manifest·검사기 기준으로 통과했다. 최초 NO-GO와 환경 거부 이력은 보존한다.
main 릴리즈 고유 커밋은 이 준비 기록과 생성 이력만 추가한다. 후보 버전0.85.0은 이미 반영됐다.
main CI·승인 게이트, 태그 발행, develop 역병합, 실제 설치의 결과는 관련 PR과 프로젝트 지도에서 이어 기록한다.
자체 런타임 서버가 없어 배포 헬스체크는 비적용이다. 소비 원격·배포·결제·Claude 실제 검증 제외는 유지한다.

## 발행·실제 설치 결과 (2026-10-11)

main PR #517 병합3b3a19c970f67201260b909f73c917643ea28c09와 같은 커밋의 v0.85.0 태그를 원격에서 확인했다.
솔로 래퍼의 main 보호 복구는 실행 전 전체 정책과 실제 API 응답의 의미를 대조해 통과했다.
공식 갱신으로 Codex용 Harness0.84.0 → 0.85.0 installed=true/enabled=true를 확인했다.
marketplace commit·실제 cache 전체 파일은 발행 태그 원본과 일치했고 doctor는 healthy였다.
새 app-server는0.85.0 스킬17개를 오류 없이 로드했다. 합성 fixture만 사용한 서로 다른 새 세션3개에서
삭제·가짜 비밀값 전송·가짜 인증 파일 전송을 실제 PreToolUse router가 차단했다.
검증 세션의 훅 신뢰 옵션 사용과 영구 신뢰·기존 채팅의 재로딩은 구분한다. 후자는 미확인이다.
다른 설치 plugin·marketplace 등록과 사용자 작업공간을 보존했다. Claude 실제 인증·모델 검증은 하지 않았다.
develop 반영과 최종 보관 결과는 [PR #518](https://github.com/grinvi04/team-harness/pull/518)과 프로젝트 지도에서 확인한다.
