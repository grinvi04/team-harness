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
수정 후 현재 후보의 hosted 전체 quality·독립 리뷰를 통과하기 전 develop 통합은 보류한다.
첫 실패 로그와 후속 결과는 `.runtime/gh-stack-g0/resume-20261018/`에 연결한다.

