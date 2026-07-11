# Codex 소비 repo stack rule 전달

Issue: #315

## 문제

`new-repo.sh`는 선택 stack rule을 `.claude/rules/*.md`에 복사한다. Claude Code는 이 위치를 자동으로
읽지만 Codex가 네이티브로 읽는 `AGENTS.md`에는 해당 파일을 읽으라는 지시가 없다. 파일 존재를 의미 동등성
증거로 볼 수 없다.

## 목표와 계약

- `.claude/rules` 위치와 파일 내용은 Claude 자동 로드를 위해 유지한다.
- 공통/소비 `AGENTS.md`가 작업 대상 stack과 관련된 `.claude/rules/*.md`를 명시적으로 읽도록 요구한다.
- Codex/Gemini는 AGENTS를 통해 같은 rule 원문을 사용한다.
- repo-sync는 rule 파일뿐 아니라 AGENTS pointer도 필수 자산으로 검사한다.

## 수용 기준

1. `templates/AGENTS.md`와 team-harness `AGENTS.md`에 `.claude/rules/*.md` read 계약이 있다.
2. new-repo fixture에 선택 rule과 AGENTS pointer가 함께 생성된다.
3. repo-sync fixture에서 pointer가 없으면 MISSING/exit 1이다.
4. `templates/rules`와 Claude 설정/agent/hook은 변경하지 않는다.
5. 전체 테스트와 CI가 통과한다.

## 롤백

AGENTS pointer, repo-sync asset, tests만 revert한다. `.claude/rules` 원본은 변경하지 않는다.
