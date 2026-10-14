# 기존 저장소의 선택 자산 관리

`scripts/manage-repo-assets.mjs`는 사용자가 지정한 파일만 기존 Git 저장소에 적용한다.
제품 방향 판정은 **소유**다: 재사용 구성의 출처·소유·갱신·제거를 검사한다.
앱 명령, 플랫폼의 hook 설치, 전역 설정, 원격 저장소, 분리 package 실험은 이 기능의 범위 밖이다.

## 준비와 미리보기

Node.js와 Git이 필요하다. 원본과 대상은 서로 분리된 Git 저장소의 실제 절대 루트 경로여야 한다.
symlink가 포함된 루트 경로는 실제 경로로 바꿔 지정한다.
원본은 전체 commit SHA에 고정된 깨끗한 checkout이어야 한다. 개발 중인 원본을 직접 적용하지 않는다.
태그가 있는 배포 후보는 `--version vX.Y.Z`도 지정한다. 태그의 commit과 SHA가 다르면 거부한다.
로컬 태그의 일치 검사는 발행자 신원·서명·원격 발행 여부를 인증하지 않는다.
`--version` 없는 SHA 후보는 출력과 소유 기록에서 `unreleased:<SHA>`로 표시되며 릴리즈 인수가 아니다.

사용자가 검토한 JSON plan은 각각 원본·대상 루트 기준의 파일 경로를 선택한다.

```json
{
  "assets": [
    {
      "source": "templates/githooks/commit-msg",
      "destination": ".githooks/harness-commit-msg"
    },
    {
      "source": "docs/code-review.md",
      "destination": "docs/harness-code-review.md"
    }
  ]
}
```

기존 hook을 대체하지 않는 별도 파일 이름을 고른 예다. 적용은 hook을 활성화하거나 실행하지 않는다.
원래 제품 검사에 연결하는 결정과 앱 명령은 제품 저장소가 소유한다.

```bash
node /path/to/team-harness/scripts/manage-repo-assets.mjs apply \
  --repo /path/to/app --source /path/to/released-source \
  --revision <40-character-commit-SHA> --version vX.Y.Z \
  --plan /path/to/reviewed-plan.json
```

기본은 preview다. 출력의 `changes`에 파일과 create/update/remove가 표시된다.
파일·디렉터리·Git 설정·원격은 변경하지 않는다. 확인한 동일 명령에 `--apply`를 붙여 적용한다.
실패 시 exit2, 정상 preview·적용 시 exit0이다. 동일 apply 재실행은 소유 기록과 파일을 중복 생성하지 않는다.

## 갱신과 제거

적용 후 대상의 `.harness-assets.json`은 schema1, 원본 SHA·버전, 선택 경로, SHA-256·권한을 기록한다.
이 기록과 관리 파일을 함께 버전 관리한다. 소유 기록은 권한 증명이나 위조 방지 수단이 아니다.
갱신 전 관리 파일과 기록이 제품 저장소의 검토된 상태인지 확인한다.

```bash
# 새 고정 원본의 SHA·태그로 바꾸고 우선 preview한다.
node /path/to/team-harness/scripts/manage-repo-assets.mjs update \
  --repo /path/to/app --source /path/to/released-source \
  --revision <new-40-character-SHA> --version vX.Y.Z \
  --plan /path/to/reviewed-plan.json

# 제거도 preview가 기본이다. 적용하려면 --apply를 붙인다.
node /path/to/team-harness/scripts/manage-repo-assets.mjs remove \
  --repo /path/to/app --source /path/to/released-source \
  --revision <40-character-SHA> --version vX.Y.Z \
  --plan /path/to/reviewed-plan.json
```

update/remove plan의 대상 경로 집합은 소유 기록과 정확히 같아야 한다.
선택 집합을 바꾸려면 기존 집합을 먼저 안전하게 제거한 뒤 새 plan을 적용한다.
update는 현재 원본 파일을 이전 상태로 간주하지 않는다. 기록된 hash·권한과 대상 파일을 비교한다.
사용자가 바꾸거나 삭제한 관리 파일, 기록 없는 기존 파일은 덮어쓰거나 제거하지 않는다.
동일한 내용의 기존 파일도 기록 없으면 사용자 소유로 간주하고 거부한다.
충돌은 수동 검토로 해결한다. 강제 덮어쓰기 옵션은 없다.

remove는 변경 없는 소유 파일과 소유 기록만 제거한다. 빈 부모 디렉터리는 남긴다.
기존 앱 검사·hook·설정·Git 설정·원격과 계획 밖 파일은 보존한다.

## 안전 경계와 검증 범위

모든 파일을 쓰기 전에 plan·출처·대상·기록을 검사한다.
절대/상위/빈/점 경로, `.git`, 소유 기록 경로, 중복·겹치는 대상, symlink,
공유 hardlink 파일, 중첩 Git 저장소로 들어가는 경로를 거부한다.
예약 경로·중복·부모 경로 겹침은 NFC 정규화와 대소문자 비교로 확인한다.
원래 Git 경로는 바꾸지 않으며 기존 소유 기록의 경로 별칭도 쓰기 전에 거부한다.
원본 파일은 해당 SHA의 추적된 일반 Git blob이어야 하며 checkout 바이트도 blob과 일치해야 한다.
원본 Git 실행권한을 복사한다. 기록된 대상 권한 변경도 사용자 변경으로 거부한다.

파일은 같은 디렉터리에 준비한 뒤 rename으로 교체한다. 적용 전 `.harness-assets-transaction/`에
선택한 비민감 자산의 원본·계획·내용/권한 지문을 기록한다(디렉터리700, journal600).
이 경로는 Harness 실행 간 잠금이며, 남아 있으면 새 적용을 거부한다. 다른 편집기를 막는 OS 잠금은 아니다.
각 쓰기와 복구 직전에 현재 내용을 재검사한다. 포착한 실패는 Harness가 쓴 상태와 일치하는 파일만
원본으로 복원한다. 동시 편집·임시 파일 변경은 보존하고 `rollback incomplete`와 충돌 경로를 보고한다.
정상 완료·전체 rollback 뒤 기록을 제거하며 부분 실패·중단 시에는 복구 근거를 남긴다.

중단 후에는 원래 프로세스와 다른 writer가 종료됐는지 확인한 뒤 **수동 rollback**한다.

```bash
node /path/to/team-harness/scripts/manage-repo-assets.mjs recover --repo /path/to/app
node /path/to/team-harness/scripts/manage-repo-assets.mjs recover --repo /path/to/app --apply
```

첫 명령은 읽기 전용 preview다. 두 번째는 남은 계획을 완수하지 않고 원본 복원을 시도한다.
journal 누락·손상·위험 경로·살아 있는 PID·불일치 지문은 거부하며 현재 사용자 파일을 덮어쓰지 않는다.
활성 PID는 재사용될 수 있어 보수적으로 거부할 수 있다. 복구 자체가 강제 종료되어 `recovery.lock`이
남으면 실제 프로세스·기록을 수동 점검한다. 확인 없이 잠금이나 journal을 지워 재실행하지 않는다.
journal은 신뢰하는 로컬 복구 기록이며 변조 인증 수단이 아니다. `.env`와 예약 경로는 plan에서 거부한다.
비밀 자동 탐지를 보장하지 않으므로 plan에 승인된 비민감 파일만 선택한다.

파일 하나의 rename은 원자적이지만 전 파일 교체의 동시성·자동 crash 복구·전원 손실 복구·ACL/확장 속성은
보장하지 않는다. 대상 파일의 배타적 편집이 전제다. 확보할 수 없으면 격리 사본에서 diff를 검토한다.

```bash
node --check scripts/manage-repo-assets.mjs
node --test tests/repo-assets-test.mjs
```

임시 실제 Git 저장소 시험은 preview 무변경, SHA·태그, 멱등 적용, 새 원본 갱신,
수정·미소유 충돌, 경로 거부, 쓰기·부분 교체·제거 실패 복구와 제품 흐름 보존을 확인한다.
실제 회사 제품의 명령 실행·원격 통제·운영 적용·회사 채택은 미확인이다.
로컬 fixture 결과를 그 인수 결과로 확대하지 않는다. 통합 품질·독립 검토는 별도 판정한다.
