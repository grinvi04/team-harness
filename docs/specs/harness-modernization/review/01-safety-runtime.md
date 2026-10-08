# 안전·실행 경계의 발견

표시: 재현은 현재 검사기 또는 순수 함수를 실행한 결과다. 정적 확인은 실제 API 변경·파일 덮어쓰기·모델 호출을 하지 않은 코드 경로 분석이다.

## S01 — 보호 설정 적용 전에 조회 실패를 차단해야 한다

재현. [set-branch-protection.sh](https://github.com/grinvi04/team-harness/blob/980fe87b4429e601e7f95155063eb2c28906fbaf/plugins/harness-guard/scripts/set-branch-protection.sh#L161)가 check-runs 조회 실패를 빈 검사 목록으로 취급한다.
상태를 저장하는 가짜 gh API에서 main/develop의 required_status_checks가 null로 변경된 뒤 exit 1을 반환했다.
[원시 결과](../protection-probe/result.json). 실제 GitHub에는 쓰지 않았다. 수정 시 발견 실패·명시적 빈 목록·정상 발견을 구분해야 한다.

## S02 — 비밀 파일 전송 인수 형태가 빠져 있다

재현. [egress guard](https://github.com/grinvi04/team-harness/blob/980fe87b4429e601e7f95155063eb2c28906fbaf/plugins/harness-guard/scripts/codex-secret-egress-guard.mjs)는 다음 유효한 명령 문자열에 exit 0을 반환했다.
`curl --url-query @.env`, `curl -F 'file=<.env'`, `wget --method=POST --body-file=.env`.
기존 `--data-binary @.env`, `-F 'file=@.env'`, `--post-file=.env`는 exit 2였다. README 전송 문자열은 허용했다.
[분류 입력·출력](../guard-probes/results.json). 전송 명령·파일 읽기는 실행하지 않았다. 실제 유출에는 별도의 실행·네트워크 권한이 필요하다.

## S03 — 로컬 파괴 명령의 절대 경로 형태

재현. [guard.sh](https://github.com/grinvi04/team-harness/blob/980fe87b4429e601e7f95155063eb2c28906fbaf/plugins/harness-guard/scripts/guard.sh)와 [tokenize.sh](https://github.com/grinvi04/team-harness/blob/980fe87b4429e601e7f95155063eb2c28906fbaf/plugins/harness-guard/scripts/lib/tokenize.sh)는 bare git/rm과 절대 경로를 다르게 판정한다.
`git reset --hard`, `rm -rf tests`는 exit 2이고 `/usr/bin/git reset --hard`, `/bin/rm -rf tests`는 exit 0이었다.
[분류 결과](../guard-probes/results.json). 실제 reset·삭제는 실행하지 않았다. 문서가 이미 인정한 모든 셸 우회를 새 결함으로 세지 않는다.

## S04 — smoke 실행 파일의 정체성 검사 연결

정적 확인. [native pilot](https://github.com/grinvi04/team-harness/blob/980fe87b4429e601e7f95155063eb2c28906fbaf/scripts/run-codex-native-loader-pilot.mjs#L354)은 바이너리 digest·CDHash를 전달한다.
그러나 [smoke](https://github.com/grinvi04/team-harness/blob/980fe87b4429e601e7f95155063eb2c28906fbaf/scripts/codex-fresh-session-smoke.sh#L18)는 CODEX_BIN을 직접 실행해 runVerified 경로를 통하지 않는다.
부모의 앞선 호출 검사만으로 세 번째 호출도 같은 바이너리였다고 증명할 수 없다. 실행 파일 바꿔치기는 실제로 수행하지 않았다.

## S05 — 원본의 Git SHA와 읽는 바이트가 충분히 묶이지 않는다

정적 확인. native pilot은 HEAD/tree/status를 확인하지만 실제 checker와 smoke는 원본 경로를 읽고 GIT_* 환경을 상속한다.
skip-worktree 등으로 작업 파일 바이트와 Git의 깨끗한 상태가 달라질 수 있는 반례가 있다. 원본 index를 변경하지 않았다.
검증 후보를 독립적으로 materialize하고 Git 환경을 정리하는 기존 split runner 방식과 일관되게 맞추는 편이 낫다.

## S06 — 보고서 출력 후의 원본 변경을 놓칠 수 있다

정적 확인. native pilot은 unchanged/PASS 스냅샷 뒤 finally에서 보고서를 쓰며 출력 경로·기존 파일을 충분히 제한하지 않는다.
원본 내부 경로를 보고서 대상으로 주면 unchanged 판단 뒤 파일이 추가·덮어쓰기 될 수 있다. symlink·기존 대상도 계약에 포함해야 한다.
실제 덮어쓰기는 하지 않았다. 금지 경로, 독점 생성, 마지막 상태 확인이 같은 실행을 덮도록 바꿔야 한다.

## S07 — profile 설치 경로와 JSON·셸 quoting

순수 함수·메모리 파일 시스템 재현. [manage-profile](https://github.com/grinvi04/team-harness/blob/980fe87b4429e601e7f95155063eb2c28906fbaf/scripts/manage-profile.mjs#L69)은 hook 명령에 원시 경로를 넣는다.
공백 경로는 JSON은 유효해도 셸에서 나뉘고, 큰따옴표 경로는 JSON까지 깨질 수 있다.
[profile-doctor](https://github.com/grinvi04/team-harness/blob/980fe87b4429e601e7f95155063eb2c28906fbaf/scripts/profile-doctor.mjs#L106)의 존재·digest·부분 문자열 확인으로 이 실패를 걸러내지 못한다. 실제 설치는 하지 않았다.

## S08 — 외부 cache patch의 double-quote는 명령 치환을 보존하지 않는다

순수 함수와 무해한 printf 재현. [patch script](https://github.com/grinvi04/team-harness/blob/980fe87b4429e601e7f95155063eb2c28906fbaf/plugins/harness-guard/scripts/patch-codex-security-guidance.mjs#L17)는 달러 명령 치환·backtick을 escape하지 않는다.
경로의 `$(printf HARNESS_PROBE)`와 backtick이 문자 그대로 보존되지 않고 셸에서 확장된다. 일반 공백 경로는 정상 대조군이었다.
[결과](../legacy-quoting-probes.json). patch main·설치·실제 외부 cache 변경은 하지 않았다. 먼저 공식 surface로 제거 가능한지 판단한다.

## S09 — PR 판정과 실제 병합 후보 사이

정적 확인. [pr-merge](https://github.com/grinvi04/team-harness/blob/980fe87b4429e601e7f95155063eb2c28906fbaf/plugins/harness-guard/scripts/pr-merge.sh#L120)는 base를 먼저 확인하고 나중에 head를 고정하지 않은 merge를 실행한다.
검사·리뷰 뒤 head 또는 base가 바뀌는 경우를 같은 후보의 증거로 취급해서는 안 된다.
[gh 공식 옵션](https://cli.github.com/manual/gh_pr_merge)의 --match-head-commit은 head를 묶는다. 원자적 base 비교 지원은 미확인이다. 서버 CI 보호 자체가 사라진다는 주장은 아니다.

## S10 — 적용 가능한 Alembic 검사 실행 실패가 성공으로 바뀐다

정적 확인. [CI template](https://github.com/grinvi04/team-harness/blob/980fe87b4429e601e7f95155063eb2c28906fbaf/templates/ci/alembic-heads.yml#L34)은 alembic.ini가 있는데도 의존성 설치 또는 heads 실행 실패를 exit 0으로 처리한다.
설정이 없어 비적용인 경우와, 적용 대상의 검사 실행 실패를 구분해야 한다.
[new-repo](https://github.com/grinvi04/team-harness/blob/980fe87b4429e601e7f95155063eb2c28906fbaf/scripts/new-repo.sh)는 해당 검사를 필수 검사로 연결한다. 이름이 성공한 것만으로 실제 검증을 보장하지 않는다.

## S11 — Alembic 한 줄 함수의 파괴 작업 누락

재현. [checker](https://github.com/grinvi04/team-harness/blob/980fe87b4429e601e7f95155063eb2c28906fbaf/scripts/check-alembic-destructive-ddl.mjs#L291)는 `def upgrade(): op.drop_table(...)`의 같은 줄 본문을 놓친다.
Python AST에서 유효한 입력이다. 한 줄은 exit 0, 같은 작업의 여러 줄 대조군은 exit 1이었다.
[입력·판정](../ddl-probes/results.json). 실제 Alembic/DB 실행은 없었다.

## S12 — ActiveRecord 탭 구분

재현. [checker](https://github.com/grinvi04/team-harness/blob/980fe87b4429e601e7f95155063eb2c28906fbaf/scripts/check-activerecord-destructive-ddl.mjs#L313)는 drop_table 뒤 탭을 호출 구분자로 놓친다.
Ruby 구문 검사는 통과했다. 탭 입력은 exit 0, 공백 대조군은 exit 1이었다.
[입력·판정](../ddl-probes/results.json). 실제 Rails/DB 실행은 없었다.

## S13 — SQL DROP에서 COLUMN 생략

재현. [checker](https://github.com/grinvi04/team-harness/blob/980fe87b4429e601e7f95155063eb2c28906fbaf/scripts/check-destructive-ddl.mjs#L412)는 `ALTER TABLE audit_log DROP old_col`을 허용했다.
[PostgreSQL 문법](https://www.postgresql.org/docs/17/sql-altertable.html)은 COLUMN 생략을 허용한다. COLUMN을 쓴 대조군은 거부했다.
[교정 후 결과](../ddl-probes/retries.json). 첫 SQL probe는 scan root 밖이라 SKIP이었다. 이를 반례로 세지 않고 db/migration으로 바꾼 실행을 별도 보존했다.

## S14 — ORM raw SQL의 MySQL 실행 주석

재현. Alembic op.execute와 ActiveRecord execute의 `/*!50000 DROP TABLE ... */`은 일반 주석처럼 제거되어 exit 0이었다.
[MySQL 실행 주석](https://dev.mysql.com/doc/refman/8.4/en/comments.html)은 서버가 실행할 수 있다. SQL checker 대조군은 같은 입력을 거부했다.
[ORM 결과](../ddl-probes/results.json), [SQL 대조군](../ddl-probes/retries.json). 동적 SQL·helper 호출 등 이미 문서화된 정적 검사 한계와 별도로 다룬다.

## S15 — 전역 실행 허용 prefix가 넓다

정책 판정 재현. default.rules (`$HOME/.codex/rules/default.rules`, 당시 로컬 원본)는 377개 allow 규칙을 저장하며 git push·gh api의 넓은 prefix를 포함한다.
초기 CLI의 execpolicy check는 강제 main push와 gh api DELETE 보호 설정 명령에도 allow를 반환했다.
업데이트된 0.161.0에서도 같은 두 입력과 정상 git status를 다시 분류해 모두 allow를 확인했다. [최신 정책 판정](../planning-execpolicy-probes.json). 분류 대상 명령 자체는 실행하지 않았다.
[판정 결과](../global-rule-probes.json). 명령은 실행하지 않았다. 이 결과는 task 승인·샌드박스·서버 보호의 우회를 뜻하지 않는다.
기존에 승인한 규칙을 임의로 철회하지 않는다. 다음 설정 변경 때 읽기/쓰기·파괴 범위와 저장된 승인 범위를 대조해야 한다.

## 현재 실제 원격 상태

다섯 저장소의 main/develop 10개 보호 설정 모두 존재하며 strict 검사·관리자 적용·대화 해결·force push/삭제 금지를 확인했다.
Harness main은 리뷰 1개, develop은 리뷰 설정 없음이다. 다른 네 저장소도 현재 리뷰 설정은 없다. 이를 곧바로 오류로 분류하지 않는다.
ERP에는 main/develop 대상으로 별도 CodeQL high-severity ruleset이 활성화돼 있다. [조회 요약](../remote-policy.json).
실제 보호 변경·권한 우회·복구 시험은 하지 않았다. S01은 도구의 실패 처리 문제이며 현재 원격 침해 증거는 아니다.
