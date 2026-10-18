# 로컬 실시간 대시보드 인수 기록

2026-10-18. 1.2.0 미발행 후보. [설계·O1–O5](../specs/local-runtime-dashboard.md)와
[T1–T4 계획](../specs/local-runtime-dashboard/implementation-plan.md)의 원래 완료 기준을 유지한다.
실제 Codex CLI·Desktop 연결과 교정 영향 검증을 확인했다.
G3의 현재 전달·최종 후보 CI·독립 검토·병합 판정은 아래 PR 원본과 마지막 판정표를 함께 따른다.

## 후보와 보존 범위

- 기반은 PR584의 develop 병합 `4c1136eea0988dc252475eb5edfbfdc241b66ee5`다.
- 실행 clone은 `team-harness/.runtime/dashboard-stack-20261018`, 원문은 그 아래 `.runtime/dashboard/`다.
- lease 교정 통합: A903d677 → B63470a4 → C640584c에서 공식 restack과 원격 각 ref 일치를 확인했다.
  실제 실행 후보·후속 문서 커밋은 구분하며 현재 head는 PR585·586·587 원본을 따른다.
- [PR585](https://github.com/grinvi04/team-harness/pull/585)→[586](https://github.com/grinvi04/team-harness/pull/586)→[587](https://github.com/grinvi04/team-harness/pull/587)를 순서대로 전달한다.
  A는 develop ecbd1ca, B는 develop f043fe4의 실제 병합·포함을 확인했다. C의 현재 결과는 PR587 원본이다.
- main·태그1.1.0 e038399는 유지했다. 승인된 c62 임시 설치 시험 후 사용자 설치1.0.0으로 복구했다.
  1.2.0 정식 main·태그·영구 설치는 미실행이다.
- [초기 T1–T3 및 첫 리뷰 교정](local-runtime-dashboard-initial.md)에 당시 명령·실패·수정·한계를 보존한다.
  그 결과를 변경된 바이트의 실행으로 바꿔 적지 않는다.

## C3ffe395 통합 실행

| 경계 | 실행 결과 | 증거·한계 |
|---|---|---|
| 전체 quality | 1–6단계 PASS, 7단계 FAIL | `full-quality-corrected/quality/results.json`; 전체 PASS 아님 |
| 문서 실패 분리 | 383건 모두 시험 사본; 동일 커밋 clean clone 소유 문서364개 PASS | `quality-clean-diagnostic/`; 검사기·기준 변경 없음 |
| 격리 CLI 설치 | 공식 Codex0.161.0; 설치100파일이 커밋 원문과 일치 | `native-cli/run-hLujAw/installed-source-match.json` |
| 실제 hook→화면 | allow 도구 실행1회·exit0, deny 실행0회·sentinel 보존; 10사건·5작업 | `native-cli/run-hLujAw/result.json`; 별도 실제 세션·후보·화면 대조 |
| 기록 경로 | host 주입 PLUGIN_DATA와 사건 경로 일치; 임의 env 주입 없음 | 같은 폴더 plan/실행 JSON·stdout/stderr; fixture는 합성 Git 저장소 |
| CLI 정리 | viewer lease0; 임시 auth 사본 두 개 제거 | `viewer-closed.json`, `credential-cleanup.json`; 원본 인증·전역 설치 보존 |
| 이동 artifact | core58파일·현재 원문 일치; HTML/CSS/JS·MIME·인증/경로 거부·갱신·정리 PASS | `package-live-corrected/`; 제작 소스/node_modules 미접근·외부 요청 없음 |
| 독립 리뷰 | 실제 Astra/medium/read-only 실행에서 O4 결함2개 발견 | `native-review-corrected/output.log`; 아래 교정 대상 |

artifact의 `installable:false`는 유지한다. 위 artifact 이동과 공식 CLI 설치는 서로 다른 검사다.
CLI 시험은 실제 호스트 경계지만 합성 저장소이며 desktop 실행·회사 효용 인수를 뜻하지 않는다.
최초 전체 quality1–5 PASS·6중단과 앞선 CLI 부분 관찰은 초기 기록에 그대로 남긴다.

## O4 검토 교정

1. 화면은 `runCheck --id`를 보관해도 보여주지 않아 같은 후보의 검사·재시도를 구분할 수 없었다.
   현재 작업·타임라인·상세에 검증된 evidenceId를 표시한다. 기존 기록에 없으면 미제공으로 남긴다.
   실행 중에도 식별하도록 started와 finished에 같은 검증된 id를 연결한다.
2. 모든 guard exit2를 GUARD_DENIED로만 기록해 보호 브랜치·검증 파일 삭제·reset 등의 이유를 잃었다.
   명시 allowlist 규칙 code와 안전한 다음 행동을 연결한다. 원문 명령·stderr는 관측 사건에 넣지 않는다.
   같은 문맥의 직접 자식 결과가 하나일 때만 부모 hook에 전달하며 누락·모호함은 기존 generic deny다.

UI 격리 clone 3ffe395 기준: 최초25 FAIL →69 PASS, legacy fallback 추가1 FAIL →71 PASS.
lint/typecheck/build write·check PASS, source5개 patch/digest와 실행 원문은 `review-fix-ui/`다.
backend 40/40 통합·24/24 단위/경계·guard191·matrix112·tokenizer32·egress279·pretool PASS.
`review-fix-guard/`에 최초 RED·환경 오류·교정 실행과9파일 digest를 보존한다.
통합 후보는 같은 source5+9파일과 생성 asset 바이트를 대조했다.
이 교정은 O4 원래 기준의 누락을 보완하며 새 인수 조건을 추가하지 않는다.

## PR585 독립 검토 교정

실제 Codex Astra/medium/read-only 리뷰가 A `cc014ba`에서 repo-only 조회의 활성 상태 오류를 찾았다.
계약상 `worktreeId`를 생략하면 저장소 전체를 읽지만, 활성 lease도 정확한 worktree 일치만 요구해
사건이 기록되는 동안 `captureState=off`로 표시했다. `pr585-review/`에 원래 리뷰와 후보를 보존한다.
reader만 같은 repo의 유효한 worktree lease를 허용한다. append와 명시 worktree 선택은 계속 정확한
대상 lease를 요구한다. 만료·잘못된 schema·다른 repo의 lease는 활성 상태나 기록 권한을 만들지 않는다.

`pr585-lease-fix/`: 원래 A+새 회귀시험에서 기대 active/실제 off 2건 RED·유지7 PASS를 확인했다.
잠긴 시험을 유지한 최소 교정 후 타깃9/9, observation+boundaries22/22·exit0·160.91초 PASS다.
기존10×100 writer·32MiB 한도 시험과 구문·diff 검사도 유지했다. 소스2개와 시험1개의 digest를
실제 통합 바이트에 대조했다. 이 결과는 로컬 교정 검증이며 새 PR 후보의 독립 리뷰·CI는 별도다.

## Cc62e8ca 통합 검증

- `full-quality-final/`: 깨끗한 clone에서 CI quality1–30 PASS, 31단계 repo-sync FAIL(45 PASS/3 FAIL).
  실제 dashboard 제작 스택을 감지한 결과에 기존 시험이 스택 없음을 요구한 원인이다.
  scanner·소비 repo 거부는 유지하고 TS/Vite·React 감지와 중첩 Java/Flyway 제외를 단언했다.
  `repo-sync-diagnostic/green-overlay-prepared.json`: 같은 후보+시험 파일 교정,48 PASS/0 FAIL와 하위3 PASS.
  첫 도구 미준비 실패도 보존한다. `full-quality-tail/`까지77단계를 모두 실행했고 최초72 PASS/5 FAIL이다.
  원래 후보의31·47·54·63·71 FAIL은 아래 교정 근거와 별도로 보존한다.
- `combined-final/`: 별도 깨끗한 같은 후보에서 dashboard·observation·build 결합 명령 PASS.
- `package-live-o4/`: artifact58파일, 변경 runtime/asset15파일이 커밋과 일치한다.
  HTML/CSS/JS·MIME·token401·경로404·갱신·원문/제작 의존성 미접근·외부 요청 없음·lease0 PASS.
- `native-cli/run-tW9e4c/`: 공식 Codex0.161.0 격리 설치100파일 일치.
  실제 allow 명령1회/exit0, deny 실행0회·sentinel 보존, 10사건/5작업과 실제 화면 PASS.
  deny는 `GUARD_VERIFICATION_DELETE`와 구체적인 다음 행동으로 표시된다.
- 같은 설치본의 명시 `runCheck` 과제에서 `o4-explicit-smoke`가 시작·종료·상세 모두 일치한다.
  이 과제는 명시 API 실행이며 native hook 실행 증거와 구분한다. 원문2사건과 실제 화면을 보존했다.
- viewer 종료·lease0, 임시 session auth 사본 제거, 원본 인증·전역1.0.0 설치 보존을 확인했다.

## quality 교정과 재사용 경계

| 최초 실패 | 확인 원인·최소 교정 | 교정 실행 |
|---|---|---|
| 31 repo-sync | self repo의 React·TS/Vite 감지 기대값 정정; scanner·소비 repo 거부 유지 | `repo-sync-diagnostic/green-overlay-prepared.json` 48+3 PASS |
| 47 플랫폼 목록 | B의 새 Codex 관측 helper를 정확한 목록에 추가 | `platform-inventory-fix/` 15 PASS |
| 54 변경 이력 | 구현 커밋 이후 각 층의1.2.0 변경 이력을 재생성 | `changelog-fix/`, `claude-baseline-fix/b-changelog-*` 전체 문서 시험 PASS |
| 63·71 공용 표면 | 승인된 O4 guard 변경의 해시 한 행 갱신; 기존 행·검사 유지 | `claude-baseline-fix/` native loader·명시 Claude surface 검사 PASS |

교정 통합 Cb11faa5의 plugin100파일·dashboard 제작 원문은 Cc62e8ca와 같았고 hosted39089091469는 PASS다.
이후 repo-only lease 수정으로 event/read 소스2개가 달라졌다. 기존 UI71·asset 및 hook 연결 근거는
변경되지 않은 범위만 재사용하며 C640584c의 영향 검사·실제 CLI·이동 artifact를 아래에 별도로 기록한다.
원래77단계 실행, 교정 명령·로그·후보·파일 해시 대조는 `quality-corrections/`에 연결한다.
최종 문서·현재 SHA 패키지·PR CI/리뷰는 전달 후보에서 별도로 확인한다. Claude 실호스트 확인을 뜻하지 않는다.

## lease 교정 이후 실제 실행

- `pr585-review-after-lease/`: A903d677·base4c1136e의 공식 Codex Astra/medium/read-only 리뷰에서 추가 결함 미발견.
  checkout은 clean, 명령·실행 설정·원본 리뷰를 보존했다. 이후 후보 변경은 새 snapshot으로 검토한다.
- `pr585-lease-integration/`: C640584c의 깨끗한 별도 clone에서 npm ci·runCheck/통합50개·결합28개 PASS.
  30개 관련 소스 digest가 커밋과 일치한다. 기존 실패·거부·writer/용량 조건을 유지했다.
- `native-cli/run-H9WWAz/`: C640584c 공식 Codex0.161.0 격리 설치100파일 일치.
  실제 허용1회 exit0·삭제 실행0회·sentinel 보존·10사건/5작업·실제 화면과 session/SHA/reason 대조 PASS.
  임시 auth 사본 제거·원본 인증 보존을 확인했다. 시험 driver의 SIGINT 후 남은 소유 lease는
  프로세스 종료를 확인하고 공식 removeLease로 정리했다. 제품 CLI의 정상 종료 시험과 구분한다.
- `package-live-lease/`: 같은 C640584c의 이동 artifact58파일과 catalog·원본55파일이 일치한다.
  HTML/CSS/JS·MIME·거부·갱신·제작 의존성 미접근·외부 요청 없음·정상 종료 lease0 PASS.

## 승인된 Desktop 실행·복구

- `desktop/`: 승인한 c62e8ca를 공식 명령으로 임시 설치하고100파일 일치를 확인했다. 검증 대화는1개다.
- 첫 시험은 대화 작업 폴더가 Git 밖이라 사건0·UNVERIFIED였다. hook 차단과 이 최초 결과를 보존했다.
  같은 대화의 빈 작업 폴더에 같은 합성 커밋2c78e36을 배치해 host cwd와 viewer 대상을 맞췄다.
- 실제 native skill 목록과 wrapper 읽기, allow1회 exit0·deny 실행0회·sentinel 보존을 확인했다.
  session `01a14cd7-2105-77e0-a33a-bf0c36778605`, 같은 SHA·10사건/5작업·세부 이유가 실제 화면과 일치한다.
- viewer 정상 종료·lease0 후 v1.0.0/69c198b로 복구했다. 설치77파일·전체 plugin/marketplace 목록·선택 설정이 원래와 같다.
- 이 결과는 c62의 실제 Desktop 연결이다. C640 실제 Desktop 설치나 전체 skill workflow 평가로 확대하지 않는다.
  `first-attempt.json`, `result.json`, `restoration.json`과 원본 도구·화면 기록을 함께 읽는다.

## 실제 stack 전달·후보 연결

A8e4dbb8과 서버 재기반 B6f7d090은 각 후보의 필수 CI5개·전체 quality(각80·81단계)와
공식 Codex Astra/medium/read-only 리뷰를 확인한 뒤 최하단부터 병합했다. 미해결 thread는0이다.
develop의 strict·관리자 보호·필수5개를 유지했고 solo 예외는 사용하지 않았다.
각 병합 뒤 원격 후보를 fetch하고 공식 sync의 preview·fingerprint·apply·수신 journal을 보존했다.
대시보드는 실제 stack/pr-merge의 MERGED 사건과 후보 변경 뒤 이전 근거 표시를 확인했다.
원문: `post-desktop-docs/`, `g3-observation/`. C60a3261→서버 재기반 C8aa7744는 전체1172파일 바이트가 같다.
`current-package-final/`의 C60a3261 package 검사23/6/5/4·bundle33과 checksum112/112는 PASS다.
후속 후보는 바뀐 문서와 runtime 바이트를 구분하고, 해당 SHA bundle·checksum·CI·리뷰를 별도로 기록한다.
실제 C 병합 SHA·develop 포함과 최종 O1–O5/G3 판정은 [PR587](https://github.com/grinvi04/team-harness/pull/587)의 전달 결과가 정본이다.

## 현재 판정과 다음 단계

| 기준 | 확보한 실행 근거 | 최종 전달에서 대조할 근거 |
|---|---|---|
| O1 | 구현·영향 검사 PASS | 저장·한도·lease 교정22/22와 최종 PR 후보 대조 |
| O2 | 구현·실제 연결 PASS | 원결과 보존·CLI/Desktop 연결; 후속 층 CI·독립 검토 |
| O3 | 구현·영향 검사 PASS | 미확정 병합·복구·용량과 현재 후보50+28 회귀; G3 실제 병합 |
| O4 | 실제 화면 PASS | 현재/상세·검사 이름·세부 이유; 후속 층 독립 검토 |
| O5 | 실제 CLI·Desktop·이동 artifact PASS | 현재 SHA 패키지·전체 quality와 최종 독립 대조 |
| G3 | 실제 3층 제출·수정·서버 재기반·순차 전달 | 각 PR의 CI·독립 리뷰·실제 병합 SHA·develop 포함 |

최종 전달은 현재 후보의 CI·독립 리뷰 → 실제 병합·develop 포함 → O1–O5/G3 대조 순서다.
이 표는 증거 연결이며 원격 결과를 미리 PASS로 선언하지 않는다. 현재 판정과 다음 행동은 PR587 전달 결과에서 확인한다.
정식 main·태그·사용자 설치는 그 후 별도 전달 범위다. Claude 실호스트는 미확인 보류로 유지한다.
소비 저장소 수정·회사 고유 정책·실제 사람 인수는 현재 잔여 기준에 넣지 않는다.
