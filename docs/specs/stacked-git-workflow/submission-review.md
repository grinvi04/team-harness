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

