# PR584 제출 경계 검증

현재 작업 범위는 [공식 stack 설계](../stacked-git-workflow.md)와 [구현 계획](implementation-plan.md)을 따른다.
본문 전달·태그 경계만 보완하며 Git Flow·기존 검증·보호를 유지한다.

## PR584 제출 경계 후속 — 2026-10-16

고정 후보 `31cac4c`의 read-only Codex/Astra medium 리뷰에서 중복 push가 `push.followTags=true`를
상속해 preview 밖 annotated tag를 발행함을 발견했다. 실제 Git·bare remote 두 경로 RED→GREEN,
동시 writer 보존 PASS다. 동일 OID는 재전송하지 않고 직접 stack 생성도 고정 SHA·full ref·lease·태그 제외다.
원문은 `.runtime/gh-stack-g0/stack-integration-delivery-1/tag-boundary-fix/{red,green}.log`다. GitHub IO는 대역이다.
후속 `934fa99`의 로컬 quality74/74·로그 hash는 PASS다. 독립 리뷰는 사용량 제한으로 exit1·미확인이다.

**2026-10-18 재개:** hosted run38806701958·38806704159의 Linux quality는 각각24개 실패했다.
첫 실패는 Node child stdin을 wrapper가 `/dev/stdin` 경로로 다시 열면서 발생했다. doc-sync에도 같은 경계가 있다.
두 reader만 fd0으로 읽도록 수정하고 본문·후보 hash·사전 문서 검사·push 보호를 유지한다.
회귀는 실제 Node child stdin의 선언 본문 제출과 committed 근거 검증·stale 거부다. macOS 성공을 Linux로 확대하지 않는다.
후속4dc0783 영향106개·Astra/medium read-only 리뷰 PASS, hosted39078076952·39078972798 quality80/80·필수5 PASS.
PR 본문 갱신으로 새 CI가 생성되어 첫 병합은 차단됐다. 최신 실행 통과 후 [PR584](https://github.com/grinvi04/team-harness/pull/584)를 develop4c1136e로 병합했다.
실제 병합 tree와 hosted checkout tree가 일치하며 develop/main 전체 보호·rulesets 원값을 확인했다.
원격 작업 브랜치는 삭제, 로컬 작업공간은 기존 develop 점유를 보존해 유지했다. main/태그/설치는 실행하지 않았다.
첫 실패 로그와 후속 결과는 `.runtime/gh-stack-g0/resume-20261018/`에 연결한다.

## PR585 본문·후보 갱신 순서 — 2026-10-18

repo-only lease 교정 후보 `903d677`의 새 독립 Codex/Astra medium 읽기 전용 리뷰는 추가 결함 미발견이다.
원래 지적·RED·교정22/22와 이 리뷰는 [대시보드 인수 기록](../../pilots/local-runtime-dashboard.md)에 연결한다.
동일 후보의 최초 commitlint run39089695161은 게시 당시 본문이 옛 근거 해시를 가리켜 실패했다.
본문 교정 후39089736305는 통과했지만 이전 실패를 무시하거나 보호 검사를 줄이지 않는다.
후속 게시에서는 커밋된 각 층의 문서 해시로 본문을 먼저 맞추고 그 다음 공식 stack 경로로 ref를 게시한다.
로컬 rebase 후 후보가 달라지면 본문·현재 head/base·CI·리뷰를 다시 대조한다. 과거 실패 기록은 보존한다.

