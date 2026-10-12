# Apple Git 릴리즈 브랜치 정리 — 0.91.1

## 문제·승인 범위

2026-10-12, [#535](https://github.com/grinvi04/team-harness/issues/535).
Apple Git 2.54.0에서 추적 브랜치를 삭제할 때 빈 `branch.<name>.remote` override가 SIGSEGV를 일으켰다.
0.91.0 발행·설치는 완료됐지만 해당 helper의 정리 실패는 당시 기록에 보존되어 있다.
사용자는 수정·정상/거부 검증·독립 검토·0.91.1 병합·발행·설치를 승인했다.

## 계약과 최소 수정

- 제품 방향: 연결. Git의 기본 `branch -d`와 worktree 보호를 사용한다.
- develop에서 지정 버전의 release·backmerge 브랜치만 정리한다.
- 로컬 tip과 원격 tip은 develop에 병합되어야 한다. 원격 삭제는 조회한 OID의 lease에 결박한다.
- 빈 override를 미등록 `harness-cleanup-unconfigured-remote` 이름으로 바꾼다.
  이 이름에 URL·fetch 등 설정, 옛 remotes/branches 정의가 있거나 조회 실패면 모든 삭제 전에 중단한다.
- 저장된 upstream·merge 값은 쓰지 않는다. 복수 merge 값도 명령 override로 덮어쓰지 않는다.
- `remote=.`은 기존 첫 merge ref를 선택할 수 있어 사용하지 않는다.
- 조회 실패·거부·삭제 후 확인 실패를 성공이나 부재로 보고하지 않는다.
- 다른 프로세스의 모든 config 쓰기를 잠그는 새 프로토콜은 추가하지 않는다.
  이 검사는 실행 시작의 설정과 시험한 ref 경합 범위에 한정된다.

## 필수 검증

실제 Git 저장소와 로컬 bare origin을 사용하며 원격 서비스나 소비 프로젝트를 변경하지 않는다.
첫 실패와 재시도 원문은 작업공간 `.runtime/v0911/`에 기록하고 정리 전에 보존한다.

- 정상: 추적 없는/있는 병합 브랜치, 복수 merge 설정, 원격 삭제, 재실행 시 부재 확인.
- 거부: 미병합 로컬·원격, 다른 worktree, 잘못된 버전·checkout, 설정 충돌(URL·fetch), 설정 조회 오류.
- 경합·관찰 실패: ancestry 후 로컬 tip·upstream 변경, 원격 OID 변경, 조회·push·삭제 후 조회 실패.
- Apple Git 2.54.0 로컬과 Linux/macOS CI에서 같은 suite를 실행한다.
  CI의 실제 Git 버전은 로그에 남기며 다른 Apple Git 버전을 2.54 시험으로 세지 않는다.
- 기존 13개 시험은 보존한다. 새 4개와 독립 지적 보완 6개의 수정 전 실패·수정 후 통과를 대조한다.
- 전체 quality·독립 읽기 전용 안전 검토·live provenance·현재 커밋 package/source checksum은 릴리즈 필수다.

## 현재 검증·전달 상태

로컬 Apple Git 2.54.0: 수정 전 13/17 PASS, 새 4개 FAIL. 수정 후 17/17 PASS, SKIP 0.
독립 검토의 Important 1건(옛 remote 정의)을 실제 Git으로 재현해 remotes/branches 경로 검사로 보완했다.
보완 전 새 6개 FAIL, 보완 후 23/23 PASS, SKIP 0. 일반·linked worktree의 공통 Git 경로를 확인한다.
첫 quality의 로컬 Python 도구 symlink가 repo-sync 경계를 위반해 FAIL했다. 정규 실행 파일로 바꾸고 재검사한다.
보완 후보의 독립 재검토·전체 quality·PR·병합·릴리즈·설치는 아직 미실행이다.
변경 동기화 범위는 이 스펙·decisions·maintenance·README·CHANGELOG와 새 버전 이력이다.
변하는 PR·태그·발행 결과는 아래 원본 링크와 PR의 최종 전달 기록에서 확인한다.

- [문제와 전달 원본](https://github.com/grinvi04/team-harness/issues/535)
- [0.91.1 태그·발행 원본](https://github.com/grinvi04/team-harness/releases/tag/v0.91.1)

소비 원격·배포·결제 제외. Claude 인증 갱신·실제 모델 검증 보류.
이 repo에는 실제 DB·런타임 서버가 없어 그 DB·배포 health만 비적용이며 plugin 설치는 별도로 검증한다.
