# 재설계 구현·검증 기록

2026-10-15 사용자 승인: M1부터 순서대로 끝까지 구현·검증. 기존 작업·보호·Git Flow와 합의한 기준 유지.
정본은 [전체 설계](../team-harness-redesign.md) 및 구조·완료·이전 계약이다. R1–R7과 제외 범위를 늘리지 않는다.

## 후보와 권한

- worktree: `codex/workflow-maturity`, 시작 HEAD `f11280e50da61b92d203175404a524b6bc311697`.
- 시작 dirty 파일 지문: 로컬 `.runtime/redesign-20261015/start.json`. 이전 평가·공통 계약 보완을 보존한다.
- 로컬 구현·임시 fixture·격리 시험·관련 기록·후보 커밋은 이번 구현에 포함한다.
- M6의 공유 원격·태그·영구 설치는 별도 전달 범위다. 먼저 구현·검증 가능한 작업을 마친다.
- 미발행1.0.0에 같은 breaking 후보를 통합한다. 설계만으로 버전을 반복 증가시키지 않는다.
- 실제 사람·회사 고유 인수와 소비 제품 수정은 제외. Claude 실호스트는 미확인 보류다.

## 순서·판정

| 단계 | 필수 계약·검사 | 상태 |
|---|---|---|
| M1 | 관찰 정확 집합·캐시·추가/삭제·후보/cwd·원문·첫 실패·누락·집계 반례; 기존 QA 회귀 | PASS: 56 tests |
| M2 | 로컬 점검·선택 자산·스택 정본; 정상/충돌/중단/복구와 기존 검사 보존 | PASS: 아래 M2 근거 |
| M3 | 공통 계약·native 진입·라우팅 축소; 실제 범위·writer·인계 | PASS: 구조 회귀와 아래 실제 CLI·데스크톱 |
| M4 | 명시/채택 base 선택; 기존 SHA·CI·리뷰·보호·복구 정상/거부 | 회귀 PASS; 원격 쓰기 없음 |
| M5 | 전체 quality·artifact·고정 지원 표의 실제 실행·독립 검토·문서 일치 | PASS: 고정 R1–R7, M6 제외 |
| M6 | 승인된 전달 범위의 순차 Git Flow·릴리즈·설치 | 후속 승인: [전달 기록](delivery.md) 참조 |

작업별 새 발견은 기존 R 기준에 연결한다. 확장은 제안으로 분리하며 현재 종료 조건으로 삼지 않는다.
기계 검사와 모델 실행을 구분한다. 기존 실제 평가의 제한 PASS와 최초 FAIL을 보존한다.

## M1 검사 계약

`tests/acceptance/`는 Harness 자체 시험이며 소비 프로젝트 필수 상태/JSON 엔진이 아니다.
기존 QA 명령 결박 fixture의 기준과 비교하며 controller 관측과 actor 보고를 구분한다.
테스트는 별도 bounded worker가 작성하고 통합 담당자가 검수·잠근 뒤 구현한다. 최종 독립 판정은 다른 실행이 맡는다.
관찰은 명시한 fixture 경계만 읽으며 비밀 경로·symlink는 거부/명시 제외한다. 일반 비밀 탐지 보장은 하지 않는다.
시험 최초 결과·수정 이유·관련 재시험은 해당 단계 원문 로그에 보존한다.

## 실행 근거

- M1 최초 반례: 기존 관찰기가 `.npm-cache/new.log` 추가를 놓쳐 assertion exit1.
  원문 `.runtime/redesign-20261015/m1-original-observer.log`를 보존한다.
- 새 관찰/판정/보고 모듈의 29개 반례와 실제 child 명령·범위 통합 시험, 기존 QA 회귀:
  `node --test tests/acceptance/*-test.mjs tests/qa-command-binding-test.mjs tests/qa-practical-test.mjs`.
  56 PASS / 0 FAIL / 0 SKIP. 원문 `m1-regression.log`; CI quality에도 연결했다.
- 이는 controller가 관찰한 fixture 사실의 일치 검사다. 임의 제출 원문의 진실·업무 의미·호스트 실행은 보증하지 않는다.
- M2 카탈로그 시험의 첫 실행은 테스트 변수 중복 선언으로 실행 전 실패했다. 수정 후 원래 모듈에서
  순서 변경 거부 반례를 별도로 재현했다(`m2-catalog-behavior-red.log`). 구문 오류를 행동 RED로 세지 않는다.

## M2 연결·복구

- `node --test tests/repo-assets-test.mjs`: 최초 8개 RED, 수정 후55 PASS. 추가로 임시 파일 사용자 수정
  보존과 잠금 중 journal 변경을 각각 RED→GREEN으로 확인했다. 원본/지문·단계 기록과 수동 recover를 제공한다.
- `bash tests/stack-templates-test.sh`: 선언 순서 변경·중복 ID 거부와 기존 생성물/조합 회귀 PASS.
- `bash tests/new-repo-test.sh`: 43 PASS. 기본 실행은 GitHub 호출0, `--with-protection`은 기존 원격 검사 유지.
  첫 실행의 Python parser 미준비는 환경 실패로 보존했다. CI와 동일 packaging26.3의 기존 격리 Python으로 재검증했다.
- 로컬 생성기20 PASS: `TMPDIR=/private/tmp node --test tests/local-setup-test.mjs tests/local-profiles-test.mjs`.
  첫 실행은 macOS `/var` 별칭 경로를 거부했다. 실제 경로 환경으로 재시험했으며 링크 거부 조건은 유지했다.
- 원문: `.runtime/redesign-20261015/m2-*.log`. 자산 worker의 최종 검사와 파일 지문은 대화 실행 결과에 남긴다.
- 기존 검사·제품 파일·원격 보호는 보존한다. 새로운 실제 원격 변경이나 소비 제품 적용은 수행하지 않았다.

## M3–M4 연결

- 모든17개 공유 skill은 최소 프로젝트 계약을 읽는다. 프론트 기준은 조건부 참조, Codex wrapper는
  공유 metadata에서 생성한다. 기존17개 task별 native 문구와 권한·no-log 계약을 보존했다.
- generator16반례·계약11·mapping19·flagship51·native loader 보호 회귀 PASS. 실제 로딩과 의미 준수는 별도다.
- 기본 UserPromptSubmit 연결을 제거했다. PreToolUse 명령·matcher·timeout·시크릿 prompt는 보존했다.
  외부 파일럿의 새 schema3은 명시 `$plan`과 실제 본문 read를 기록하고 과거 schema2 증거는 보존한다.
- M4 원래 구현은 새 base 반례22/23에 실패했다. branchFlow 선언·명시 인자·원격 exact ref 검증 후
  28개 base 시험과 회사 policy9개 PASS. release/hotfix→develop 반례2개도 별도 RED→GREEN 확인했다.
- 기존 PR 생성9+리뷰40, 자동 병합70, solo81 회귀 PASS. 실제 원격 변경·보호 변경은 수행하지 않았다.
- Markdown 최초 호출은 template의 가상 배치 루트 누락으로2건 실패했다. CI와 동일한 virtual-root로
  재실행해341문서 PASS. 이 호출 오류를 제품 결함이나 행동 RED로 세지 않는다.

## M5 실행 예산·중단 조건

현재 공개 진입의 후보 관측이며 이전 대조군 평가를 다시 반복하지 않는다. 계약 본문은 프롬프트에 넣지 않는다.
필수 CLI: 격리된 공식 설치1회, 문서 기반 첫 확인1회·진단/수정2회·새 문맥 인계1회,
실제 allow/deny hook4회 이내. actual 데스크톱 새 세션1회는 고정 호스트 표대로 별도 관측한다.
독립 최종 검토1회와 실제 발견의 영향 재검토만 추가한다. 각 실행은180초 상한으로 중단하며
도구·인증 실패나 필수 반례는 원문 보존 후 원인/변경 근거 없이 반복하지 않는다.
합성 제품·살아 있는 writer·관찰기 판정은 실제 사람 효용과 별개다. 원격 발행은 수행하지 않았다.
추가 명시 승인으로 Team Harness만 임시 설치하고 새 데스크톱 대화1개를 시험한 뒤 v0.93.2로 복구했다.

## M5 최초 실패·보완 기록

- 로컬 후보 `ac842ac`의 quality1–42 통과 후43 공개 안전성에서 FAIL: 기존 평가 JSON/MD의 홈 절대경로.
  원문은 비공개 runtime 사본과 SHA로 보존하고 공개 표시만 `$HOME`으로 정규화했다. 판정·기존 증거 지문은 유지했다.
  `public-safety-audit-test.sh`20/20, 소유 Markdown341개 검사 PASS. 실패 원문은 별도 지우지 않는다.
- 실제 모델 호출 전 controller의 `appliedSettings` 연결을 `.status`로 맞췄다. 순수37개 검사와 syntax PASS.
  writer의 임시 쓰기는 관찰 제품 밖 controller 영역에서 atomic rename하며 실제 소유 파일 쓰기와 관측은 유지한다.
- 전체 명령·최초 실패·후속 실행은 로컬 `.runtime/redesign-live-20261015/`에 보존한다.
  원격 CI·새 원격 검증·발행·영구 설치를 완료한 기록은 아니다.
- 후속 quality51은 새 구현 커밋 뒤 CHANGELOG 미생성으로 FAIL했다. 기존 생성 명령으로
  미발행 v1.0.0 항목을 갱신하고 재현 검사를 실행했다. 기능 검사 통과로 이 실패를 대체하지 않는다.

## M5 최종 판정: 2026-10-15

구현 검증 후보는 `71a1d6333b81735122306de7875ae3d526ba8991`, tree는
`7a9f1979da5dc5be982c35dc256a42fcc2bf2379`다. 이후 변경은 이번 판정을 기록하는 문서뿐이다.
[공개 실행 요약](../../pilots/redesign-2026-10-15.json)은 원문 지문·명령·후보·기준과 독립 판정을 연결한다.
원문은 주 checkout의 `.runtime/redesign-live-20261015/`에 보존하며 공개 호스팅된 증거로 주장하지 않는다.
배우/controller의 당시 `semanticReview=PENDING` 원문은 수정하지 않고 별도 독립 검토 결과와 결합한다.

| 기준 | 현재 판정 | 근거·적용 범위 |
|---|---|---|
| R1 | PASS | 자산55·new-repo43·로컬20 등 정상/충돌/중단·복구; 기존 검사·타 writer 변경 보존 |
| R2 | PASS | 공개 문서를 실제 읽은 첫 확인·진단은 관찰 경계 무변경; 승인된 수정은 허용 파일만 변경 |
| R3 | PASS | M1 반례56·후보/원문 결박, quality 원문 지문과 독립 검토; 누락·첫 실패 보존 |
| R4 | PASS | 실제 새 문맥·writer 관측·최신 요구; 부분 성공과 통합 FAIL 구분, 소유 영역 보존 |
| R5 | PASS | 로컬 base·현재 SHA·필수 CI/리뷰·자동/solo 복구 회귀; 새로운 원격 전달은 M6 별도 |
| R6 | PASS | 아래 고정 CLI·현재 데스크톱의 공식 설치/본문/hook, 복구; Claude는 소스 호환만 |
| R7 | PASS | 새 문맥의 README→기존 검사→업무/인계, 미지원 runner와 미실행의 정확한 안내 |

### 품질과 실제 CLI

- quality74개 스텝의 최신 결과가 모두 exit0이다. 최초43·51 실패와 영향 재시험을 보존했다.
  무변경 검사는 원래 후보와 지문을 유지해 재사용했다. 실행기 수정 영향은 재검사했다.
- macOS의 기존 ripgrep, 고정 Python/packaging/Ruff, 실제 TMPDIR, 로컬 doc-sync 입력으로 재현했다.
  Ubuntu 준비·GitHub 이벤트를 그대로 실행한 hosted CI 성공으로 보고하지 않는다.
- source-only bundle의 후보·archive·SHA256SUMS를 확인했다. installable package는 아니다.
  checksum 첫 호출은 잘못된 cwd로 exit2였으며 bundle cwd의 재호출에서 두 항목을 통과했다.
- CLI0.161.0: 공식 격리 설치1회와 Sol6.1/medium 실제8회, 각1시도. hook 정상1·거부3,
  첫 확인·진단·수정·새 문맥 인계4회다. 원문에서 실제 model/effort/sandbox를 확인했다.
- 격리 후보의 hook 신뢰 확인에는 명시 실행 옵션을 사용했다. PreToolUse 자체는 실제 실행돼
  테스트 삭제와 합성 secret/credential 전송 요청을 차단했다. 실제 인증정보 전송 시험은 하지 않았다.
- 수정: 독립 재현 oracle exit1→수정 뒤 root 검사4 PASS·oracle exit0. 최초 RED를 남겼다.
- 인계: writer276회 관측과 신선한 소유 상태를 읽고 허용 파일만 수정했다. summary4 PASS지만
  다른 writer 소유 library 때문에 root 검사는 exit1이다. 이 전체 FAIL을 숨기지 않는 것이 인수의 기대 결과다.
- CLI의 read-only 두 세션에서 제품 경계 쓰기는 없었다. 첫 Git 조회의 xcrun 캐시 쓰기는 권한 거부됐다.
  인계의 직접 OS 프로세스 조회도 거부됐으며 writer 관측과 구분해 미확인으로 보고했다.
- 격리 HOME·writer 프로세스 정리, 관찰한 사용자 config/plugin 지문 보존을 확인했다.

### 실제 데스크톱·복구·독립 검토

- 추가 승인한 새 대화 `01a13ca3-f954-7080-8908-c46add10774a`1회에서 실제 캐시1.0.0의
  plan wrapper→공유 본문→계약·native·QA 참조를 읽었다. 후보와 cache77파일 대조도 통과했다.
- 호스트는 ChatGPT.app26.1007.30912(20156)의 CodexCLI0.162.0-alpha.17.2이다.
  실제 Sol6.1/high·never·danger-full-access였으며 읽기 전용 sandbox로 실행했다고 주장하지 않는다.
- 정상 명령1회 exit0·삭제 요청1회 PreToolUse 차단 원문을 확인했다. fixture3파일의 생성 바이트는 보존됐다.
- 공식 명령으로 원래 Git 소스의 v0.93.2를 복구했다. 전체 설정의 파싱값·다른 plugin 자산·기존 cache는 같다.
  설정 파일 포맷이 바뀌어 바이트까지 동일하지는 않다. 설치 원본은 애초 v0.93.2 고정이었고 목록 생략을 정정했다.
- 시험 fixture/source·복구용 cache 사본·비공개 설정 백업을 정리했다. 실행 증거와 새 대화는 보존한다.
- Astra/medium·never·read-only의 최종 독립 검토와 R6 영향 검토에서 차단 결함0을 확인했다.
  첫 검토의 데스크톱 미확인은 추가 실제 증거로 해소했다. 검토자가 후보를 수정하지 않았다.
- 원본 rollout의 후속 append는 최초64행 해시와 추출18기록의 일치로 대조했다. 최신 전체 해시로 과거 값을 덮지 않았다.

판정 한계: 선정한 경계·명령·후보·호스트의 검증이다. 전체 머신 무쓰기·모든 셸/경합·사람 효용·생산성 우위는 보장하지 않는다.
복구 후 새 데스크톱 실행은 하지 않았다. 원래 고정된 시험에 추가 세션을 완료 조건으로 붙이지 않는다.
**M1–M5 필수 미해결0.** M6 정식 PR·순차 Git Flow·release-check·태그·영구 설치는 별도 전달이다.
Claude 실호스트는 미확인 보류, 실제 사람·회사 고유 인수·소비 제품 수정은 이번 필수 집합 밖으로 유지한다.
