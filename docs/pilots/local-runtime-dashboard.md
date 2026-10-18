# 로컬 실시간 대시보드 인수 기록

2026-10-18. 1.2.0 미발행 후보. [설계·O1–O5](../specs/local-runtime-dashboard.md)와
[T1–T4 계획](../specs/local-runtime-dashboard/implementation-plan.md)의 원래 완료 기준을 유지한다.
현재 **전체 quality 실행과 발견 실패의 교정 검증을 마치고 PR 전달 준비 중**이며 전체 인수는 미완료다.

## 후보와 보존 범위

- 기반은 PR584의 develop 병합 `4c1136eea0988dc252475eb5edfbfdc241b66ee5`다.
- 실행 clone은 `team-harness/.runtime/dashboard-stack-20261018`, 원문은 그 아래 `.runtime/dashboard/`다.
- 교정 통합: Acc014ba → Bea22d87 → Cce994dc에서 공식 restack과 원격 각 ref 일치를 확인했다.
  이후 C의 진행 문서·변경 이력을 갱신한다. 실제 실행 후보 Cc62e8ca와 현재 전달 후보는 구분한다.
- main·태그1.1.0 e038399와 사용자 설치1.0.0은 유지했다. 1.2.0 PR·태그·전역 설치는 미실행이다.
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

현재 plugin100파일과 dashboard 제작 원문은 Cc62e8ca와 같다. 실제 CLI·화면·이동 artifact의 동작 근거를
바이트 일치 범위에서 재사용한다. 새 SHA의 설치 실행으로 바꿔 적지 않는다. 이후 차이는 문서·검사 기대값·기준 해시다.
원래77단계 실행, 교정 명령·로그·후보·파일 해시 대조는 `quality-corrections/`에 연결한다.
최종 문서·현재 SHA 패키지·PR CI/리뷰는 전달 후보에서 별도로 확인한다. Claude 실호스트 확인을 뜻하지 않는다.

## 현재 판정과 다음 단계

| 기준 | 상태 | 완료까지 필요한 근거 |
|---|---|---|
| O1 | 통합 검증 중 | 저장·한도 기존 근거와 최종 schema 변경 영향 대조 |
| O2 | 영향 검사 PASS | guard/wrapper 원결과 보존; 최종 quality·독립 PR 검토 대조 |
| O3 | 통합 검증 중 | 미확정 병합·복구·용량 교정의 현재 후보 회귀 |
| O4 | 영향 검사 PASS | 실제 현재/상세 화면 확인; 독립 PR 검토 대조 |
| O5 | 부분 PASS | CLI·artifact·quality 교정 PASS; 현재 SHA 패키지·승인된 desktop 실행 |
| G3 | 미실행 | 세 층 PR의 CI·독립 리뷰·최하단 순차 develop 병합 |

다음 순서: 현재 문서·패키지·PR 후보 확정 → G3 제출 → 각 층의 새 CI·독립 리뷰·최하단 순차 병합.
desktop은 Cc62e8ca 임시 전환·검증 대화1개·v1.0.0 복구안을 준비했으며 명시 승인을 기다린다.
정식 main·태그·사용자 설치는 그 후 별도 전달 범위다. Claude 실호스트는 미확인 보류로 유지한다.
소비 저장소 수정·회사 고유 정책·실제 사람 인수는 현재 잔여 기준에 넣지 않는다.
