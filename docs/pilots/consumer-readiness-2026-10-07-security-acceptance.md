# 인증 SDK·깊이 보완의 로컬 수용 기록

[상위 문서](consumer-readiness-2026-10-07.md)로 돌아간다. 아래는 원문의 해당 주제·당시 후보 기록을 순서대로 보존한 본문이다.

### 최신 인증 SDK 전환 후보

`ef6585a`는 2.x/3.9.1 비교 결과를 바탕으로 python-keycloak 7.1.1로 전환했다.
SDK 기본값에 의존하지 않고 JWK·RS256·leeway 0·exp 필수 계약을 UI/API에서 공유한다.
집중 RED 5 FAIL/20 PASS, 추가 만료/누락 계약 RED 7 FAIL/24 PASS를 보존했고 최종 31 PASS다.
기존 DB/queue/dotenv 시작 차단 계약과 새 전체 110개 시험이 통과했다. 실제 별도 Keycloak
22.0.5와 Chrome에서 admin/viewer의 로그인·코드 교환·callback·접근 허용/거부도 확인했다.
공식 최신 pin의 runtime 해석 graph 74개·개발 graph 감사가 각각 0이다. 최초 직접 audit은
macOS ensurepip SIGABRT로 실패해 원문을 보존하고, 전체 해석 graph를 고정한 별도 감사로
대체했다. 직접 pin 감사만을 전체 감사로 쓰지 않는다. PyPI Alpha classifier와 외부 운영
realm의 issuer/audience·키 회전과 당시 원격 미확인은 로컬 후보의 한계로 남겼다.
현재 원격 CI·develop 병합은 맨 아래 소비 원격 전달 후속을 따르며 배포 준비 완료는 아니다.
코드 후보 manifest는 `97f868f702d554d4773f698d93286499fdbd2d090f150a625b2d26e6de162bdc`,
독립 문서 정정 후 `2d08281`의 manifest는 `a343fc23086fb962f9dd3cc85619154e855911dd957456b171525e4a8dd78b1f`다.
개발 pin 개수 110→91과 Alpha 분류 누락을 정정했고 코드·시험은 그대로다. 실제 Chrome
callback은 제품 lifespan과 별도 실제 Redis를 사용했으며, 앞선 대역 callback과 구분한다.
이전 `eba4bfb`의 104개/15 advisory와 위험 비교 후보는 당시 사실로 보존한다.

### DriveTree 깊이 보완과 ERP의 미적용 조건

DriveTree `40ffba2`는 braces 3.0.3의 원본/패치 lib 6파일 SHA와 PR #78 commit을
고정해 postinstall·실제 설치 확인·직접 Next ESLint 소비 시험에 연결했다. 격리 연구의 정상
비교 30개·100/101 경계와 제품의 깊이/직접 AST·설치 drift·재실행·symlink·omit 보안 9개를 구분한다.
독립 검토에서 stdin import ENOENT P2를 발견해 `907ea04`에서 RED→GREEN/보안 10개로
보완했다. 최신 clean npm ci는 6파일을 실제 적용했으며, 변경 script의 형식/lint도 통과했다.
앱 입력·lock·설치 패치 SHA가 같아 40ffba2의 단위 8/build와 앞선 Chromium 20을 재사용했다.
이전 script 후보를 현재 통과로 쓰지 않으며 원격/current-browser 미실행과 감사 high 5를 유지한다.
공식 수정판이 아니므로 >100 깊이 패턴을 의도적으로 거부하고 임의 AST/출력 폭증 안전은
보장하지 않는다. 공식 호환 수정판·동등 회귀를 확인할 때 로컬 보완을 제거한다.

ERP `03a4bad`는 문서 전용 후속이다. 같은 라이브러리 반례는 재현했으나 현 rootDir 입력
노출은 확인하지 못했고 CI·Docker의 npm ci --ignore-scripts 정책 때문에 단순 postinstall은
작동하지 않는다. 적용한다면 이 경로별 명시 실행·검사를 먼저 설계해야 하며 현재 패치는 없다.
sprintf-js는 직접 과대 정밀도 오류와 실제 Jest coverage 경로에서 import 0을 구분했다.
개발 도구 잔여 감사와 미확인 노출을 수용 완료로 바꾸지 않는다.

### 이번 연속 실행의 종료 범위와 증거 보존

사용자는 승인된 확인·수정·검증·문서 현행화와 소유 worktree 정리를 마칠 때까지
연속 진행을 요청했다. Vercel 조회 보류와 소비 프로젝트 운영 배포 경계는 유지한다.
하네스 코드·플러그인 버전은 변경하지 않았으며, 현재 기록 전달만 develop PR 대상으로 한다.

- 하네스 `7e55f8e`의 quality job 63개 run step을 그대로 로컬 실행해 63 PASS다.
  최초 step 7은 pipx 부재(exit 127)로 중단됐고, 전역 설치 없이 작업 전용 pipx 환경을
  준비해 step 7~63을 재실행했다. 미변경 후보의 step 1~6 증거는 재사용한다.
  이 결과는 GitHub의 별도 secret-scan/macOS/commitlint gate 통과 주장과 구분한다.
- 소비 비교 중 샘플 설치기의 경로 별칭 성공/no-op 결함도 발견했다. 샘플 `e3f1f47`은
  realpath 직접 실행 판정과 stdin import 보호를 보완했다. 별칭 RED 1 FAIL, stdin
  RED 1 PASS/1 FAIL → 보안 9 PASS·frontend lint PASS, 독립 검토 추가 P1/P2 없음이다.
  기존 앱 QA는 입력 불변으로 재사용했으며 전체 감사 high 5 잔여는 유지한다.
- 원문·실패·ERP JUnit XML 묶음은
  `$HOME/Documents/Codex/2026-10-07/team-harness-consumer-qa-evidence/`에
  같은 SHA-256으로 보존했다. `preservation-manifest.json`은 원래 cwd/파일 경로를 바꾸지
  않고 보존 사본 위치로 연결하며 `harness-quality-combined.json`은 63단계와 최초 실패를 연결한다.
- 기존 지도·사용자 마일스톤은 `$HOME/project/team-harness/.project-map/`에
  바이트 동일하게 보존했다. 다른 채팅의 지도 작업이 종료된 뒤 서비스의 하네스 원본
  경로만 이 일반 clone으로 변경했다. 나머지 네 프로젝트 설정은 유지했고 서비스 health와
  다섯 프로젝트 페이지 HTTP 200을 확인했다. 작업용 worktree 정리 후에도 이 경로를 사용한다.

```harness-doc-sync
{"version":1,"documents":[{"path":"docs/pilots/consumer-readiness-2026-10-07.md","reason":"원본 신선도·QA 준비·최소 적용 계획과 종료 경계"},{"path":"docs/pilots/consumer-readiness-2026-10-07.json","reason":"명령·후보·원문·지문·서버 정책·미실행 구분"},{"path":"docs/product-direction.md","reason":"현재 로컬 적용 범위·원격 전달 경계와 다음 행동"}],"items":[]}
```

제한 독립 보안 검토는 원문 32개·소스 지문 35개와 위험/QA 관련 추가 12파일의 고정 Git blob을
대조해 계획 범위의 추가 차단 finding 없음으로 판정했다. 소비 시험을 재실행하거나 제품 인수를
승인한 결과는 아니다. ERP 첫 요청 전 자격증명 전송 차단과 webhook 대역/실저장 관찰 구분을
검토 결과에 따라 보강했다. 최종 전달·CI·병합은 [PR #495](https://github.com/grinvi04/team-harness/pull/495) 원본을 따른다.
소비 적용의 후속 상태·승인 범위는 [이슈 #496](https://github.com/grinvi04/team-harness/issues/496)에서 추적한다.
