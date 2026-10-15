# Harness 초기 구축 이력

이 문서는 2026-07 초기 환경과 구축 기록이다. 현재 지원·설치·승인 지침으로 사용하지 않는다.
현행 원칙은 [제품 방향](product-direction.md), 변경·전파 절차는 [유지보수 규약](harness-maintenance.md),
실제 검증 범위는 [지원 표](support.md)를 따른다. 이전 운영 원칙 전문은
[정리 전 원문](https://github.com/grinvi04/team-harness/blob/ea755661e735c3ce2fb026e3b4eaeb65e49888ac/docs/harness-operating-history.md)에 보존한다.

## 당시 제약 (2026-07 기록)

- 조직 managed settings는 아직 미도입 → **계층 0(branch protection·CI)이 최종 하드 강제**
  (Codex local hook 경로는 `/etc/codex/requirements.toml`로 머신별 고정)
- 실험 기능(agent teams 등) 미사용
- 개발 도구로 Claude Code와 Codex를 모두 지원하며, Gemini는 `AGENTS.md` + 계층 0 범위로 제한

## 당시 구축 이력

아래 체크 항목은 당시 결과이며 새 작업의 완료 기준이나 다음 작업 목록이 아니다.

- [x] v0.1 스캐폴딩 — 마켓플레이스 + harness-guard(가드·게이트·커맨드·에이전트) + 템플릿 + 온보딩
- [x] 로컬 마켓플레이스 설치·가드 실동작 검증 (cd 우회 차단, settings 키 포맷 스키마 대조)
- [x] 파일럿 리허설 — 온보딩 절차 풀 드릴, 발견 사항 반영
- [x] GitHub push (개인 private repo, 임시) + 문서 체계 구축
- [x] 팀 환경 정합화 — back-merge PR 절차, 사람 승인 게이트, AI 리뷰(`/code-review` 스킬) 연결

회사 파일럿·사내 Git 이전·조직 managed settings는 실제 도입 요구가 생길 때만 검토한다.
현재 개인 개발을 시작하거나 공통 구성을 재사용하기 위한 선행 작업이 아니다.
