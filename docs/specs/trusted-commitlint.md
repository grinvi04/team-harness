# PR과 분리된 커밋 검사 (#432)

## 범위와 계약

판정은 **소유**다. PR이 수정한 workflow·validator로 자기 커밋을 검사하는 경계를 보완한다.
기존 메시지 문법, 실제 parent metadata에 따른 merge 허용, main의 develop 이력 제외,
develop 전체 검사, 순수 main 역병합 제외와 충돌 해결 커밋 검사를 유지한다.
별도 서버·GitHub App·실행 엔진은 추가하지 않는다.

`commitlint-trusted`는 `pull_request_target`으로 기본 브랜치의 workflow와 `github.sha`에 고정한
validator를 실행한다. PR은 base 저장소의 `refs/pull/<number>/head`에서 Git 객체만 fetch하고,
이벤트 head SHA와 일치하는지 확인한다. PR 파일은 checkout·실행하지 않는다. 인증은 `contents: read`
토큰을 fetch 프로세스에만 전달하며 Git 설정에 저장하거나 validator에 전달하지 않는다.
조회 실패·잘못된 입력·head 변경은 실패로 처리한다. fork URL·PR 제목·본문을 명령에 삽입하지 않는다.

## 전환 순서

1. 기존 필수 `commitlint`를 유지하고 이름이 다른 `commitlint-trusted` workflow를 기본 브랜치에 추가한다.
2. 이후 정상 PR에서 새 검사가 현재 후보에 연결되어 성공하는지 확인한다. develop에만 코드를 넣은
   상태는 활성화가 아니다. 최초 추가 PR의 기존 CI 통과도 새 target 이벤트 실행 증거가 아니다.
3. 기존 필수 검사에 새 검사를 먼저 추가하고 원격 설정을 읽어 확인한 뒤 기존 `commitlint` 요구를
   제거한다. 다른 검사·앱 binding·strict·승인·관리자 강제 설정은 보존한다.
4. 기존 workflow를 제거하고 신규 저장소 템플릿·설정 기본값·드리프트 계약·현재 안내를 동기화한다.
   이미 사용하는 소비 repo에는 자동 전파하지 않는다. 각 repo도 같은 순서로 전환한다.

진행과 활성화 증거는 [이슈 #432](https://github.com/grinvi04/team-harness/issues/432)의 연결 PR과
현재 GitHub 설정이 정본이다. required 검사 이름 변경 없이 단순히 트리거만 교체하는 방식은 초기
필수 검사 누락을 만들 수 있어 사용하지 않는다. rollback도 이전 검사가 실제 실행되는 상태를 먼저
복원한 뒤 required context를 되돌린다. 검사를 끄거나 성공 상태를 수동 게시하지 않는다.

## 검증과 한계

- 기존 메시지·range·merge provenance 테스트를 보존한다.
- workflow 실제 shell을 격리 Git 저장소에서 실행해 정상·규칙 위반·head 변경·fetch 실패·역병합을
  확인한다. 각 실행 후 trusted HEAD·validator·작업트리가 그대로인지 확인한다.
- 배포 시 root/template workflow의 byte parity와 새 프로젝트의 required context를 확인한다.
- 고정 후보의 독립 보안 검토와 CI를 거친다. 로컬 검사는 GitHub 이벤트·fork 정책의 실제 실행을
  대신하지 않는다. 모든 GitHub Actions 결과의 위조 방지를 보장하는 별도 App identity 계약은 아니다.

GitHub는 공개 repo의 기본 `pull_request_target` 제한 정책을 2026-11-02부터 강제한다고 안내한다.
배포 관리자는 이 metadata 전용 workflow의 이벤트 허용 정책을 확인해야 한다. 제한을 자동 완화하지
않으며, 이벤트가 차단되면 required check를 제거해 우회하지 않는다.

근거: [target 이벤트 보안](https://docs.github.com/en/actions/reference/security/securely-using-pull_request_target),
[필수 검사 조건](https://docs.github.com/en/pull-requests/how-tos/merge-and-close-pull-requests/troubleshooting-required-status-checks).

## 배포 자산

루트 `.github/workflows/commitlint-trusted.yml`과 신규 repo용 `templates/ci/commitlint.yml`은 byte가
동일하다. 신규 repo의 파일명은 기존 `commitlint.yml`을 유지하지만 job/context는 `commitlint-trusted`다.
`new-repo.sh`가 그 이름을 required check 목록에 넣으며, repo-sync의 설치형 fallback digest도 같은
workflow를 가리킨다. 기존 소비 repo를 설치 도구로 덮어쓰지 않으며 드리프트는 별도 전환 대상으로 보고한다.
`new-repo.sh`는 기존 브랜치 보호를 보존한다. 보호가 없는 브랜치도 기본 브랜치의 workflow·validator
Git blob이 배포 정본과 일치하는지 확인한 뒤에만 새 보호를 적용한다. 조회 실패·미배치·이전 자산이면
보호를 쓰지 않고 실패를 반환한다. 이 사전 확인은 실제 PR 성공 확인을 대신하지 않는다.
