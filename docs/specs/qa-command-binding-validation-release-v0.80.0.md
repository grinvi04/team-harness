# v0.80.0 발행·설치·샘플 QA 기록

[상위 문서](qa-command-binding-validation.md)로 돌아간다. 아래는 원문의 해당 주제·당시 후보 기록을 순서대로 보존한 본문이다.

### 0.80.0 발행과 develop 반영 (2026-10-03)

사용자가 승인 요건의 일시 해제·복구를 포함한 솔로 머지 방식을 승인해 진행했다.
PR #481의 최종 후보 `b566caed4b3b4a32536b71da1bac0c79899a55ec`가 바뀌지 않았고
필수 CI 5개가 모두 성공, 미해결 스레드 0건, 외부 commit status 0개인 상태를 원본에서 재확인했다.
`bash plugins/harness-guard/scripts/solo-merge.sh 481` exit 0으로 main에 병합했고,
래퍼와 후속 API 조회 모두 main 승인 요건 1명·stale 승인 무효화 및 전체 필수 검사·admins 강제의 복구를 확인했다.

[PR #481](https://github.com/grinvi04/team-harness/pull/481)의 main 병합 SHA는
`0a0ee867470a7353c09b2678d9e32e9ba3c5b9cc`이며 원격 main과 일치했다.
그 커밋에 `v0.80.0`을 생성하고 `git push origin refs/tags/v0.80.0` exit 0으로 발행했다.
다른 작업트리의 main/develop 브랜치를 이동하지 않고 해당 커밋을 detached checkout으로 확인했다.
main 병합·태그 발행은 완료됐으며 develop 반영은 같은 main 커밋에서 생성한
[역병합 PR #482](https://github.com/grinvi04/team-harness/pull/482) 원본에서 추적한다. 이번 역병합의 추가 변경은 이 진행 기록과 제품 로드맵뿐이다.

정식 태그는 source plugin 0.80.0을 가리킨다. 분리 package의 `installable: false`는 유지한다.
전역 plugin 설치·샘플 설치 재검증과 소비 프로젝트 수정·배포는 후속 작업이다.
제품 런타임이 없어 HTTP 헬스체크는 비적용이며 실제 태그·원본 버전·checksum을 발행 검증으로 확인한다.
문서 갱신의 첫 Python 실행은 한글 입력 인코딩 오류로 파일을 바꾸지 못했고 커밋도 생성되지 않았다.
UTF-8을 명시한 실행으로 갱신하고 문서·diff 검사 뒤 커밋했다.


독립 검토는 첫 역병합 후보 `d1e6e10`에서 태그 기준 checksum 원본 기록이 없음을 지적했다.
이 후보의 문서만으로 태그 산출물 검증을 완료로 판정하지 않고, 태그 `0a0ee867470a7353c09b2678d9e32e9ba3c5b9cc`를
직접 checkout해 `node scripts/build-release-bundle.mjs --output /tmp/harness-release080-tag-20261003` exit 0을 확인했다.
그 묶음 디렉터리에서 `shasum -a 256 -c SHA256SUMS` exit 0, 73/73 일치를 확인했다.
manifest의 version=0.80.0·sourceCommit=태그 SHA·installable=false도 대조했다.
소스 archive SHA-256은 `520c0f05ef87190e9d4d21b45dc72aed3187d5c1d3754e0bdbabcd8a2a29674e`다.
이 근거는 발행된 태그에 한정하며 이후 develop 문서 커밋의 checksum으로 옮겨 적지 않는다.


### 0.80.0 전역 설치와 샘플 설치본 검증 (2026-10-03)

사용자가 정식 릴리즈 다음 단계인 전역 plugin 업데이트와 샘플 설치본 확인을 승인했다.
Codex CLI 0.156.1의 공식 marketplace remove/add와 plugin add로 기존 v0.75.0 source를
발행 태그 v0.80.0으로 전환했다. 실패 시 이전 source/ref로 복구하도록 실행했고 갱신은 exit 0이었다.
새 marketplace HEAD는 발행 태그 `0a0ee867470a7353c09b2678d9e32e9ba3c5b9cc`와 일치한다.
해당 source의 native checker에 `--expected-version 0.80.0 --trusted-root <발행 source의 plugin 경로>`를
전달해 exit 0과 매니페스트·훅 구성·17개 스킬 및 신뢰 원본 파일 대조를 확인했다.
Team Harness marketplace/plugin section을 제외한 전역 config 본문의 SHA-256은 갱신 전후 같았다.
모델·역할·권한·다른 plugin 설정을 변경하지 않았다. 열린 앱 대화의 skill catalog는 별도 재시작 확인 대상이다.

샘플은 `<USER_HOME>/project/team-task-board`다. 제품 코드는 수정하지 않으며 범위는 설치본의
새 세션 발견·계약 본문 읽기와 명령별 검증 보고다. 시험 전에 다음 완료 기준을 고정한다.

| 범위 | 기대 결과·기준 | 필수 증거 |
|---|---|---|
| 설치 source·native 계약 | v0.80.0 enabled, source/tag 커밋 동일, 파일 inventory/digest 동일 | 공식 CLI 결과와 발행 source native checker |
| 새 app-server 발견 | 샘플 cwd에서 설치 v0.80.0의 Harness 스킬 17개와 로딩 오류 없음 | 실제 skills/list 원문과 경로 |
| 샘플 명령·보고 | 로컬 검사 명령의 격리 회귀와 API unit 검사를 실행하고 명령·cwd·결과를 구분 | 새 native 세션의 실제 shell 호출·출력·최종 보고 |
| 보고 한계 | 실행하지 않은 backend·build·E2E·DB 보존 검사를 통과로 채우지 않음 | 실행 원문과 최종 보고 대조 |
| 변경 경계 | 제품 추적 파일과 전역의 다른 설정을 보존 | 샘플 후보·전후 파일 지문과 config 비교 |

이는 설치본 적용의 제한된 수용 확인이다. 샘플 앱 전체 QA·새 버그 수정·소비 프로젝트 전체 적용·
hook 실제 발화나 앱 재시작 완료를 자동 포함하지 않는다. 실제 실행 결과는 아래에 추가한다.


**당시 설치본 검증 보고: 제한된 수용 범위 VERIFIED.** 구조화된 발췌·부분 시험 출력·최종 보고·발견 경로는
[설치본 실행 근거](qa-install-v0.80.0-evidence.json)에 보존했다.

- 공식 설치: v0.80.0 enabled, 발행 source와 태그 SHA 일치, native 계약 검사 exit 0.
  실제 app-server가 읽은 0.80.0 cache도 `--root <cache>`와 발행 원본 `--trusted-root`로 따로 검사해
  exit 0과 전체 native inventory/digest 일치를 확인했다.
- 새 app-server: 샘플 cwd의 `skills/list(forceReload=true)`에 0.80.0 cache 경로의 Harness 스킬 17개,
  전부 enabled, 로딩 오류 0개. 이미 열린 대화의 skill catalog 갱신은 이 검사로 증명하지 않는다.
- 새 native CLI 1세션: Sol/high를 요청했고 JSONL은 별도 실제 모델 메타데이터를 노출하지 않았다.
  0.80.0 설치본의 검증 wrapper·native-runtime·공통 계약 본문을 실제 shell 명령으로 읽었다.
- 샘플 후보 `232d18e69ffb304204bd1cd7f25a007a1ea0c567`: 제품 루트의
  `python3 scripts/test_check_local.py` 최초 exit 0, 3개 통과. frontend cwd의
  `npm run test:unit -- src/api.test.ts src/api-response.test.ts` 최초 exit 0, 2파일/76개 통과.
  명령 순서·실패 중단·파일 보존은 임시 대체 명령, API 검사는 mock fetch 관찰 범위다.
- 최종 보고는 이 명령과 cwd·결과를 구분했고, 미실행한 실제 서버·DB·브라우저 검증을 완료로 채우지 않았다.
  backend·build·E2E·DB 보존은 이번 범위에서 미실행이며 앱 전체 QA는 UNVERIFIED다.
- 샘플 HEAD와 추적 파일 122개는 전후 같고 작업트리는 깨끗했다. 다른 전역 plugin의 버전·enabled도 같았다.
  새 CLI 세션 중 샘플의 project trust section이 추가된 것을 발견해, 새 section만 제거해 원래 부재 상태로 복구했다.
  복구 후 Team Harness marketplace/plugin 외 config 본문의 SHA-256이 갱신 전과 정확히 같다.

전역 설치와 새 세션의 제한된 샘플 검증은 완료다. 다음 선택 작업은 이미 열린 앱의 새 대화/재시작 후 목록
확인 또는 별도 범위로 정한 제품 QA다. hook 실제 차단과 모든 소비 프로젝트 적용·수정·배포 완료를 뜻하지 않는다.

실행 근거의 첫 정합성 검사에서 설치 계약 읽기를 3회로 가정한 단언이 실패했다. 실제로 위험 경계 문서도
추가로 읽어 4회였으며, 원문을 보존한 채 필수 세 경로의 존재를 대조해 확인했다. 제품 시험 실패는 아니었다.

### 샘플의 전체 로컬 자동 검증 (2026-10-03)

사용자가 후속 검증을 승인해 같은 샘플 후보 `232d18e69ffb304204bd1cd7f25a007a1ea0c567`의
정본 명령 `bash scripts/check-local.sh`를 제품 루트에서 최초 1회 실행했다. 설치된 0.80.0 Codex
검증 wrapper·native-runtime·공통 계약·위험 경계를 현재 agent가 읽고 적용했다. 현재 대화에
주입된 skill catalog도 0.80.0 경로를 제공한다. 위의 제한된 세션 결과는 당시 범위대로 보존한다.

시험 전에 제품의 필수 명령과 실제 저장·소비 경계를 완료 기준으로 선정했다. 기대 결과는 제품
AGENTS·README와 기존 테스트의 수용 단언이며, 테스트 개수만으로 충분성을 판정하지 않는다.

| 필수 범위·선정 이유 | 조건·기대 결과 / 관찰 경계 | 실행 결과 |
|---|---|---|
| 실행 관리·품질 gate | 자식 프로세스 관리 회귀, backend check/bootJar, frontend 타입·lint·unit·build 모두 exit 0 | PASS: 실행 관리 16개, backend 13개(실패·오류·skip 0), unit 2파일/76개, 나머지 명령 통과 |
| 실제 API·화면 연결과 오류 복구 | 등록·검색·상태 변경·수정·새로고침 보존; 실패 시 초안/기존 상태 보존; URL·IME·초점과 버전 충돌 회귀 | PASS: Chromium E2E 49개, 실패 0. 실제 API 흐름과 선택적 mock 오류 흐름을 구분 |
| 저장 후 응답 유실·중복 위험 | 같은 키 재전송·동시 등록은 1건, 다른 payload 거부, 후속 수정 유지; 브라우저 재시도와 실제 API 결과 연결 | PASS: create-retry와 version-conflicts 사례가 실제 격리 서버/DB 경계를 검사 |
| DB 재시작 보존 | 임시 file DB에 등록/수정 후 재시작; 전체 저장값과 version 동일, 기존 키 재등록은 중복·초기화 없음 | PASS: check-persistence.py 두 단언 통과, 생성한 서버 종료 |
| 자동 접근성·키보드 | 밝음/어두움 × 폭 1440/390 × 목록/편집/오류에서 axe violations 0, 키보드 편집/취소·초점 회귀 | PASS: 12개 axe 첨부의 violations 0. color-contrast incomplete는 별도 미확인 |
| 기존 자산 보존 | 새 격리 서버·DB만 사용, 원래 추적 파일·개발 DB·화면 이미지 보존 | PASS: HEAD와 추적 파일 122개 동일, 개발 데이터 2개 지문 동일, Git clean |

정본 명령의 최초 종료 코드는 **0**, 전체 로컬 자동 gate 범위는 **VERIFIED**다. Node 22.18.0,
Java 21.0.11, Python 3.9.6/macOS 환경에서 실행했다. E2E는 8081/5180 포트의 새 서버와
`jdbc:h2:mem:e2e`를 사용하고 기존 서버를 재사용하지 않았다. 재시작 검사는 임시 H2 file DB와
동적 loopback 포트를 사용했다. 의존성·build·보고서 등 무시되는 산출물 외 제품 변경은 없다.

**남은 한계:** axe 첨부 12개 모두 `color-contrast` incomplete 1개가 있어 수동 색상 대비 확인은
UNVERIFIED다. 접근성 fixture와 일부 오류 흐름은 mock 응답이며 실제 저장은 별도 API·DB 검사로
확인했다. 자동 검사 통과를 전체 WCAG·스크린리더·모든 브라우저·제품 무결함 보장으로 확대하지 않는다.
새 hook 차단 시험, 다른 소비 프로젝트 수정·배포와 원격 CI/게시도 포함하지 않는다.

원문 전체 로그·명령/cwd·후보·최초 종료 코드·보고서 판정·전후 보존 결과는
[설치본 실행 근거의 sampleFullQa](qa-install-v0.80.0-evidence.json)에 보존했다.
보고서 추출은 최초 zip 표현 가정과 다음 attachment 타입 가정 때문에 각각 실패했으나 현재 HTML의
실제 template와 상세 attachment 구조를 읽어 12개를 추출했다. 이는 증거 추출 진단이며 제품 시험을
재실행하거나 성공 결과로 덮어쓰지 않았다. 이번 기록은 Harness 로컬 문서 브랜치에만 반영한다.
문서 검사도 최초에 잘못된 `scripts/` 경로로 실행해 module-not-found였고, 실제
`plugins/harness-guard/scripts/check-document-sync.mjs` 경로로 바로잡아 선언 범위 PASS를 확인했다.

### 색상 대비 needs-review 후속 확인 (2026-10-06)

이전의 미확인은 당시 결과로 보존하고, 사용자 요청에 따라 설치된 `harness-guard:qa`와 native-runtime
계약을 적용해 해당 경계만 추가 확인했다. 현재 샘플 HEAD는 동일하고 Git 추적/index 차이·비무시
미추적 파일이 없다. 이전 임시 baseline JSON은 없어 과거 전체 지문 비교를 재실행했다는 주장은 하지 않는다.

원래 HTML 보고서의 12개 axe 첨부를 직접 읽었다. `color-contrast`의 실제 이유는 색상 위반이 아니라
`nonBmp`(비텍스트 문자)였고, 대상은 `.brand-mark`의 `▦`와 검색 label 안의 `⌕` 두 종류였다.
브랜드 장식·검색 보조 아이콘에는 각각 주변 브랜드 문구와 검색 이름/placeholder가 있다. `aria-hidden`
속성만으로 면제하지 않았으며, 기호의 비텍스트 성격은 [W3C 1.4.3 설명](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html)과
[1.4.11 설명](https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast.html)을 대조했다.

기호 대비에는 보수적으로 4.5:1을 적용했다(관련 비텍스트 최소 기준은 3:1). 실제 Chromium의
computed style에서 전경·가장 가까운 불투명 배경을 수집하고, 해당 배경까지 이미지/필터/opacity 등
계산을 왜곡하는 효과가 없음을 확인한 뒤 sRGB 상대휘도 공식으로 반올림 전 비율을 판정했다.
밝음/어두움 × 폭 1440/390 × 목록/편집/오류 × 두 기호의 **24개 관찰이 모두 PASS**다.

| 기호 | 밝은 테마 대비 | 어두운 테마 대비 | 선정 범위 판정 |
|---|---:|---:|---|
| 브랜드 장식 | 6.251879904349716:1 | 7.12941272750048:1 | PASS |
| 검색 보조 아이콘 | 5.446642681822732:1 | 8.001475264707407:1 | PASS |

`node /tmp/harness-contrast-review.mjs` 최초 exit 0, 재실행 없음. 별도 strict-port Vite 5182와
브라우저를 직접 생성/종료했고, 목록·오류 mock fixture만 사용해 실제 서버·개발 DB를 건드리지 않았다.
스크립트·관찰 원문·axe 대상·출처·종료 코드·비율은 [실행 근거의 contrastFollowup](qa-install-v0.80.0-evidence.json)에 보존한다.
이전 임시 지문 파일 부재로 비교가 실패한 사실과 현재 Git 후보/변경 대조로 확인한 범위도 구분했다.

**판정:** 기존 두 기호의 needs-review는 해소됐다. 전체 WCAG·스크린리더·모든 브라우저 검증이나
제품 무결함 보장은 여전히 이 결과의 범위가 아니다. 샘플 제품 수정·다른 소비 프로젝트 변경·배포는 없다.
설치·자동 검사·이 후속 확인 기록은 현재 Harness 로컬 문서 브랜치에 있으며 아직 원격 병합되지 않았다.
