# 기존 저장소에서 필요한 구성만 연결하기

혼자 또는 작은 팀 모두 이 경로에서 시작한다. 기존 검사·규약·hook·사용자 변경을 먼저 확인한다.
회사 정책이 있다면 그 정책도 보존한다. Team Harness 자산은 필요한 파일만 선택하며 일괄 적용하지 않는다.
구성 적용과 실제 제품 검사 성공은 구분한다. 기존 저장소에 `new-repo.sh` 전체 baseline을 덮어씌우지 않는다.

## 시작 판단

| 현재 상태 | 할 일 | 완료 기준 |
|---|---|---|
| 기존 규약·검사로 업무 가능 | 현재 명령을 그대로 사용하고 [업무 요청](solo-development.md#혼자-개발할-때)으로 이동 | 추가 설치·파일 생성 없이 필수 검사와 범위가 명확함 |
| 로컬 검사 연결만 부족 | [로컬 검사](../local-development.md)의 명시 스택·runner preview | 지원/미지원과 보존 파일 확인; 적용은 승인 범위만 |
| 문서·CI 등 일부 자산 필요 | 아래 선택 자산 preview/apply | 기존 파일 충돌 없음, 선택 자산 기록과 실제 검사 결과 확인 |
| GitHub 전달 필요 | 아래 원격 읽기 점검과 채택한 브랜치 선언 | 조회 실패를 미설정으로 오인하지 않고 기존 보호 보존 |

GitHub가 없어도 로컬 확인·개발을 시작할 수 있다. 실제 사람·회사 고유 인수는 이 연결의 필수 조건이 아니다.

## 1. 기술 자산만 시작하기

먼저 [선택 자산 관리](../repo-assets.md)의 고정 릴리즈 SHA·태그와 JSON plan을 준비한다.
원본과 대상은 서로 다른 Git 저장소의 실제 절대 루트다. 기존 파일과 충돌하지 않는 경로를 고른다.

```bash
node /path/to/team-harness/scripts/manage-repo-assets.mjs apply \
  --repo /path/to/company-app --source /path/to/released-source \
  --revision <40-character-SHA> --version vX.Y.Z \
  --plan /path/to/reviewed-plan.json
```

기본 preview에서 경로·변경을 검토한 뒤 같은 명령에 `--apply`를 붙인다.
적용·갱신·제거는 제품 저장소에 `.harness-assets.json`과 hash·권한을 기록한다.
사용자 변경은 강제 덮어쓰지 않는다. 자체 앱 검사·기존 hook 연결은 제품의 검토로 결정한다.

```bash
bash /path/to/team-harness/scripts/harness-doctor.sh \
  --repo /path/to/company-app --components tech
```

`tech`는 기록된 선택 파일의 존재·hash·권한·경로를 읽기 전용으로 검사한다.
Codex·GitHub 설치나 개인 한국어 commit 규칙·전체 template·repo-sync 기준을 요구하지 않는다.
기록 없으면 `UNVERIFIED`와 exit1이다. 수정·누락·잘못된 기록·symlink 파일은 `FAIL`이다.
PASS는 기록과 로컬 파일의 일치이며, 파일이 지시하는 앱 명령의 성공이나 서명 인증이 아니다.
검토한 소유 기록과 관리 파일을 제품 Git에서 함께 관리한다.

필요하면 `templates/company/AGENTS.md`를 별도 working agreement 파일로 선택한다.
기존 AGENTS를 자동 교체하지 않는다. 회사의 validator·언어·브랜치·계획 기록을 유지한다.
`templates/githooks/commit-msg`와 한국어 validator는 개인 기본 규약을 채택할 때만 함께 고른다.
공용 guard의 feature 브랜치 파일 검사는 계획 연결을 돕는 보조 장치이며 승인 판정이 아니다.
기존 회사 계획을 그 연결 파일에 참조하고 승인 기록은 원본에서 확인한다.

## 2. GitHub를 선택했다면

회사 정책 보존·변경 경계는 [회사 GitHub 정책 안내](../company-policy.md)를 따른다.
doctor의 `github` 선택은 인증 가능한 `gh`로 repo와 선택 브랜치의 protection 응답을 조회한다.
조회 실패·브랜치 부재·잘못된 응답은 FAIL이다. 기존 회사 정책을 변경하지 않는다.
당시 0.93.0 후보는 GET의 null 앱 결박·리뷰 설정 생략을 정상 조회로 처리한다.
null 결박의 정책 쓰기·변경 계획은 계속 차단한다. doctor PASS는 쓰기나 병합 허가가 아니다.

```bash
bash /path/to/team-harness/scripts/harness-doctor.sh \
  --repo /path/to/company-app --components github --branches main

# 두 브랜치를 회사에서 사용한다면 명시 선택한다.
bash /path/to/team-harness/scripts/harness-doctor.sh \
  --repo /path/to/company-app --components tech,github --branches main,develop
```

이 결과는 protection의 읽기 가능 여부다. 회사의 required checks·승인·실제 서버 집행 인수는 별도다.
Codex가 설치되지 않아도 `github` 검사에 영향이 없다. 원격 생성·보호 변경·push·merge는 하지 않는다.
`--branches`는 `main` 또는 `main,develop`이며 기본은 후자다.

## 3. Codex를 선택했다면

이미 승인된 설치 경로로 설치한 후 read-only 검사를 실행한다. doctor는 설치·복구하지 않는다.
Node.js, Codex CLI, 표준 라이브러리 `tomllib`이 있는 Python3.11 이상이 필요하다.
기본 `python3`가 이전 버전이면 설치된 인터프리터를 `PYTHON_BIN`으로 명시한다.

```bash
PYTHON_BIN=python3.11 bash /path/to/team-harness/scripts/harness-doctor.sh \
  --repo /path/to/company-app --components codex

# 회사가 승인한 설치 버전을 확인하려면 선택적으로 지정한다.
PYTHON_BIN=python3.11 bash /path/to/team-harness/scripts/harness-doctor.sh \
  --repo /path/to/company-app --components codex --expected-version <approved-version>
```

Codex 검사 범위는 다음과 같다.

- `/etc/codex/requirements.toml`의 `[features] hooks = true`가 boolean으로 강제돼 있는지.
  회사 marker·순서·주석·다른 정책은 byte 동일성 기준으로 거부하지 않는다.
  `CODEX_REQUIREMENTS_PATH`는 격리 시험 등 명시한 다른 파일을 읽을 때만 사용한다.
- CLI 조회, `harness-guard@team-harness` 활성 설치 상태와 설치 version.
- 설치 원본 manifest와 설치 version의 일치, 기존 native hook·skill 계약 검사.
  다운로드나 source checkout의 version과 설치본이 다르다는 사실만으로 FAIL하지 않는다.
  `--expected-version`을 지정하면 그 승인 version과도 일치해야 한다.

이는 현재 구성의 PASS이며 새 세션의 실제 hook 집행은 아직 확인하지 않았다.
기본 출력은 `UNVERIFIED fresh-session probe`다. `RESULT healthy`도 선택한 구성 검사만 뜻한다.
실행 플랫폼의 공식 권한·관리 정책 집행이나 회사 전체 보호를 이 결과로 보장하지 않는다.

```bash
# 모델 호출·격리 실행이 승인된 경우에만 명시 probe를 요청한다.
PYTHON_BIN=python3.11 bash /path/to/team-harness/scripts/harness-doctor.sh \
  --repo /path/to/company-app --components codex --probe
```

`--probe`는 codex를 선택해야 하며 실제 fresh-session 검사 경로를 실행한다.
필수 구성 검사 실패 시 probe는 실행하지 않고 UNVERIFIED로 표시한다.
로컬 native probe와 제품 앱 실행·CI·독립 팀 관찰은 서로 다른 인수다.

## 호환성과 현재 한계

`--components`를 생략하면 기존 개인용 전체 검사(repo-sync·Codex·GitHub)를 유지한다.
회사 안내에서는 반드시 component를 명시하여 선택 범위만 검사한다.
선택은 comma 집합이며 `tech`, `github`, `codex`를 중복 없이 조합한다.
명령은 파일·전역 설정·회사 TOML·Git 설정·GitHub 상태를 변경하지 않는다.
실행하지 않은 native probe를 제외하고 필수 구성 FAIL/UNVERIFIED가 남으면 exit1이다.
잘못된 옵션·구성 집합은 exit2다.

로컬 시험은 격리 자산과 fake CLI/API로 선택·거부·probe dispatch를 확인한다.
당시 0.93.1의 보편적인 GitHub·PR·CI 환경 개선·발행·설치는 완료했다.
제품 앱·회사 고유 정책·실제 사람 효용·운영 적용은 이 기술 완료와 구분한다. 회사 고유 정책 인수는 그 기술 완료 범위의 잔여가 아니다.
Claude 실제 hook은 UNVERIFIED·보류이며 자동 재개하지 않는다.
해당 범위·증거·종료 조건은 [완료 판정](../company-acceptance.md#보편적인-개발-환경-기준의-현재-완료-판정)을 따른다.
