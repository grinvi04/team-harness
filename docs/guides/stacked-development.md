# 의존 PR을 층별로 개발하기

서로 의존하는 변경을 작은 PR로 나눌 때만 선택한다. 독립 기능은 별도 브랜치·stack으로 둔다.
일반 1PR의 생성·리뷰·병합 절차는 그대로이며, stack 선택이 승인·CI·보호 예외를 추가하지 않는다.
[설계](../specs/stacked-git-workflow.md)와 [인수 계획](../specs/stacked-git-workflow/implementation-plan.md)이
지원 범위와 현재 검증 상태의 정본이다. 아래 명령 예시는 실제 원격·배포 패키지 검증 완료의 증거가 아니다.

## 준비와 대상 확인

- 현재 adapter는 `github.com`의 같은 저장소·`origin`을 대상으로 한다. fork·다른 push 목적지는 거부한다.
- 공식 `gh stack` **0.2.1**을 먼저 설치·검증한다. adapter는 설치·업데이트하지 않는다.
- 제품의 기존 `.harness-policy.json`에 아래 선택을 합친다. 다른 정책 필드는 보존한다.
  `git-flow`는 trunk=`develop`, `main`은 trunk=`main`이다. repo default branch로 추측하지 않는다.

```json
{
  "branchFlow": "git-flow",
  "stackedPRs": { "enabled": true, "provider": "github-gh-stack" }
}
```

모든 예시는 제품 저장소의 해당 worktree에서 실행한다. 각 도구 호출에서
[현재 스킬 경로](../../plugins/harness-guard/runtime-path.md)를 검증하고 `HARNESS_PLUGIN_ROOT`를 정한다.
이 값은 현재 로드된 플러그인 root이며 별도 HOME checkout이나 오래된 cache로 대체하지 않는다.

```bash
gh stack --version
```

층 이름은 `feature/`, `fix/`, `codex/`로 시작한다. 기존 스펙·커밋·검사 계약을 먼저 충족한다.
작업 트리는 깨끗해야 하며 대상 층을 다른 worktree에서 쓰거나 잠갔다면 진행하지 않는다.
필요한 Git 객체가 없으면 먼저 승인 범위에서 fetch하고 ancestry를 다시 확인한다.

## 시작·층 추가·현재 상태

아래는 Git Flow 예다. main 중심 저장소에서는 `--base main`을 명시한다.
`init/add`는 공식 로컬 엔진 명령이며 브랜치·metadata를 바꾼다. 조회만 요청받았다면 실행하지 않는다.

```bash
gh stack init --base develop codex/auth
# auth의 고유 변경을 구현·검사·커밋한 뒤
gh stack add codex/api
# api의 고유 변경을 구현·검사·커밋한 뒤
gh stack add codex/ui
# ui의 고유 변경도 구현·검사·커밋한다
gh stack view --json
bash "${HARNESS_PLUGIN_ROOT:?}/scripts/stack.sh" inspect
```

`init`는 이름이 같은 기존 브랜치를 채택할 수도 있으므로 대상 refs와 소유자를 먼저 확인한다.
대화형 init의 rerere 설정 질문은 별도 설정 변경이다. 비대화형 실행은 기존 설정을 보존한다.
`inspect`는 실제 refs·원격 PR·층 순서·worktree와 policy를 대조한다. 내부 `view`가 PR cache를
갱신할 수 있지만 PR 생성·push는 하지 않는다. `localCheck/remoteCheck` 거부 이유를 먼저 해결한다.

## 층별 본문을 준비하고 제출하기

각 본문에 그 층의 고유 변경·직접 parent와의 diff·검사 결과를 적는다. 제품에서 요구하면
`harness-doc-sync` 선언도 그 층의 커밋된 후보에 맞춘다. 누적 trunk diff만으로 층 리뷰를 대신하지 않는다.
아래 `/tmp` 경로는 예시다. 파일은 미리 준비하며, worktree 안의 미추적 계획·본문 때문에
dirty 검사를 통과하지 못하지 않도록 보관 위치를 정한다. 비밀정보를 본문에 넣지 않는다.

`/tmp/stack-submit.json`의 형식은 다음과 같다. 순서는 **최하단→최상단**이며 모든 층을 정확히 덮는다.
`bodyFile`은 실행 위치 기준 경로이므로 절대 경로를 권장한다. draft 필드는 받지 않는다.

```json
{
  "schemaVersion": 1,
  "layers": [
    { "branch": "codex/auth", "title": "feat: 인증 추가", "bodyFile": "/tmp/auth-pr.md" },
    { "branch": "codex/api", "title": "feat: API 추가", "bodyFile": "/tmp/api-pr.md" },
    { "branch": "codex/ui", "title": "feat: 화면 추가", "bodyFile": "/tmp/ui-pr.md" }
  ]
}
```

```bash
bash "${HARNESS_PLUGIN_ROOT:?}/scripts/stack.sh" submit --plan /tmp/stack-submit.json
# 출력의 snapshot·plan을 검토하고, 그 출력의 fingerprint로 바꾼다
bash "${HARNESS_PLUGIN_ROOT:?}/scripts/stack.sh" submit --plan /tmp/stack-submit.json \
  --apply --expected '<submit preview fingerprint>'
```

`inspect`의 fingerprint를 submit에 쓰지 않는다. submit preview는 후보와 제목·본문 hash를 함께 결박한다.
apply는 관찰한 OID에 대한 lease·atomic push, 기존 `pr-create.sh` 검증, 공식 stack link와 readback을 수행한다.
wrapper는 이미 전송된 동일 OID를 다시 push하지 않는다. 직접 `--stack` 생성도 고정 SHA·대상 ref·
최초 원격 OID lease와 `--no-follow-tags`를 사용하며 사용자의 `push.followTags` 설정을 바꾸지 않는다.
최하단 새 PR은 일반 PR, 상위 새 PR은 draft로 생성한다. 기존 PR은 생성하지 않고 건너뛰므로
재실행이 기존 제목·본문을 갱신한다고 가정하지 않는다. 상위 기존 PR도 제출 시 draft여야 한다.
draft 해제는 해당 층이 다음 병합 후보가 된 뒤 현재 head/base의 리뷰·검사를 확인하는 별도 단계다.
공식 `gh stack submit` 직접 호출은 Harness의 본문·PR gate 연결을 대신하지 않는다.

## 아래 층 수정과 trunk 동기화

아래 층 수정 후 descendants의 parent ancestry를 다시 맞추는 것은 `restack`이다.
trunk의 새 변경을 반영하는 것은 `sync`다. 각각 preview 후 **같은 명령의** fingerprint로 apply한다.

```bash
bash "${HARNESS_PLUGIN_ROOT:?}/scripts/stack.sh" restack
bash "${HARNESS_PLUGIN_ROOT:?}/scripts/stack.sh" restack \
  --apply --expected '<restack preview fingerprint>'

bash "${HARNESS_PLUGIN_ROOT:?}/scripts/stack.sh" sync
bash "${HARNESS_PLUGIN_ROOT:?}/scripts/stack.sh" sync \
  --apply --expected '<sync preview fingerprint>'
```

restack은 공식 `rebase --no-trunk`, sync는 `rebase --remote origin`을 사용한다.
adapter가 rebase와 전송을 분리하며 원래 관찰한 원격 OID를 lease로 유지한다.
관찰 후 달라진 원격 OID·dirty/locked worktree·미확정 queue가 있으면 중단한다.
서버 재기반으로 갈라진 층은 과거 confirmed 전송/수신 journal과 현재 로컬 OID가 같을 때만
sync preview의 `adoptions`에 나온다. 수신 시 옛 OID를 recovery ref로 보존하며 미발행 로컬 변경은 덮어쓰지 않는다.
공식 `gh stack sync`나 `sync --prune` 직접 호출로 이 경계를 건너뛰지 않는다.
재기반·서버 retarget 후에는 head/base·고유 diff·CI·리뷰 증거를 새 후보로 다시 확인한다.

충돌 시 출력된 journal과 native rebase 상태를 보존한다. 충돌을 해결한 뒤 `gh stack rebase --continue`,
또는 명시적으로 `gh stack rebase --abort`한다. 이후 **원래 action**으로 preview와 apply를 다시 한다.

```bash
bash "${HARNESS_PLUGIN_ROOT:?}/scripts/stack.sh" restack --resume '/absolute/journal.json'
bash "${HARNESS_PLUGIN_ROOT:?}/scripts/stack.sh" restack --resume '/absolute/journal.json' \
  --apply --expected '<resume preview fingerprint>'
```

sync 복구는 위의 `restack` 두 곳을 `sync`로 바꾼다. 이 재개는 원격 push를 할 수 있다.
원격 수신 중 detach·ref 갱신·checkout이 중단됐으면 이 일반 재개를 거부한다.
journal의 `remoteAdoption` 단계·원래 branch/OID·recovery ref와 실제 작업 상태를 먼저 대조하고 보존한다.
submit에는 `--resume`이 없다. 부분 성공·응답 유실은 journal과 현재 PR/refs를 먼저 대조하고
성공한 PR·refs를 삭제하거나 같은 mutation을 맹목적으로 반복하지 않는다.

## 한 PR씩 병합하고 미확정 요청을 재조회하기

일반 PR과 stack 모두 기존 리뷰·CI·승인·외부 상태 gate를 먼저 충족하고 같은 wrapper를 쓴다.
다음 예시의 PR 번호·base·두 OID는 검토한 실제 후보 값으로 바꾼다.

```bash
bash "${HARNESS_PLUGIN_ROOT:?}/scripts/pr-merge.sh" 123 --base develop \
  --expected-head '<40자리 head OID>' --expected-base-oid '<40자리 base OID>'
```

일반 PR은 기존 단일 PR 병합·정리 경로를 따른다. `--auto`는 일반 develop PR의 기존 조건에서만 쓴다.
stack은 **현재 최하단이며 actual base가 trunk인 PR 하나**만 요청하며 `--auto`를 거부한다.
구성·head·trunk를 gate 전후 재조회하고 `merge-async`에 검토한 head를 보낸다.
상위 PR을 선택해 여러 층을 묵시적으로 병합하지 않는다. 전체 진행 요청도 한 층씩 새 후보를 검증한다.

`pending`, `enqueued`, `unverified`는 병합 완료가 아니다. 기본 5초 간격·총 30초까지만 대기하며,
응답 유실·충돌하는 409·알 수 없는 상태에서 새 PUT을 자동 재시도하지 않는다.
실제 PR의 병합 SHA와 trunk 포함까지 확인해야 `merged`다. stack 브랜치는 자동 삭제하지 않는다.
서버 retarget/rebase 후 다음 층을 다시 검증하고 모든 의도한 층의 trunk 포함 후 release를 시작한다.

병합 출력의 journal 경로를 보존한다. 같은 저장소의 Git common-dir를 사용하는 worktree에서 다음
**내부 복구 CLI**로 기존 요청만 재조회한다. `pr-merge.sh --resume` 옵션은 없다.

```bash
node "${HARNESS_PLUGIN_ROOT:?}/scripts/stack-merge-cli.mjs" resume '/absolute/merge-journal.json'
```

위 `resume`은 linked stack용이다. 일반 solo PR은 같은 journal에 `finish`를 실행한다.
일반 PR도 요청 전에 intent를 저장하며, `finish`는 실제 PR의 후보·병합 SHA·trunk 포함과 전체
보호 복원을 다시 읽는다. 둘 다 확인돼야 예약을 해제한다. 미확정이면 보존하며 재제출하지 않는다.

이 재개는 원격 GET만 하며 새 병합 PUT을 보내지 않는다. 로컬 journal·잠금·확인 기록은 갱신한다.
UUID를 잃었어도 새 요청을 만들지 않으며 실제 PR/trunk 확인으로 확정할 수 없으면 미확정을 유지한다.
restack/sync journal과 병합 journal은 서로 바꿔 쓰지 않는다.

solo는 기존 개인 저장소 자격과 승인된 예외 범위만 유지한다. merge queue는 보호 변경 전에 거부하며,
같은 repo/base의 미확정 요청·보호 복구 불일치가 있으면 다음 예외를 차단한다.
INT/TERM/HUP에서 자식 종료·보호 복구 성공은 이미 접수된 원격 요청 취소를 뜻하지 않는다.
SIGKILL·전원 손실의 자동 복구는 보장하지 않는다. 보호 원값 readback과 원격 병합 상태를 각각 확인한다.
재조회는 새 보호 변경·정책 복구 권한을 부여하지 않는다.
