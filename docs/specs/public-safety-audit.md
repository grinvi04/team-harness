# 공개 안전성 감사 스펙

## 1. 목표 & Why

Team Harness를 공개 상태로 유지해도 되는지 Git 히스토리 시크릿, 개인·내부 식별정보, 라이선스와 자산
provenance 관점에서 실측하고 결과를 정본으로 남긴다. **성공 기준: 현재 공개 차단 결함이 없고, 확인한
범위·명령·잔여 한계를 재현할 수 있으며, 현재 파일의 안전 baseline이 CI에서 회귀하지 않는다.**

제품 방향 판정은 **소유**다. 공개 안전성과 provenance는 Team Harness가 직접 책임지는 증거 계약이다.

## 2. Scope

- **In:** 전체 Git refs gitleaks 스캔, 현재·히스토리 절대 홈 경로와 공개 프로젝트 식별자 분류, Git 작성자
  메타데이터 공개성 확인, 루트 MIT 라이선스와 바이너리·vendored 자산 provenance 점검, 현재 절대경로 제거,
  감사 보고서·README·제품 로드맵 연결, CI 회귀 계약.
- **Out:** Git 히스토리 재작성, 공개 소비 repo 내용 변경, GitHub 프로필 변경, 새 범용 secret scanner 개발,
  플러그인·소비 repo 실행 계약 변경.

## 3. 기능 요구사항 + 수용기준 (= 테스트 계약)

- **AC-1 (증거):** WHEN 공개 안전성 보고서를 읽을 때, 감사 기준 SHA·날짜·실행 명령·축별 결과·잔여 한계와
  최종 판정을 확인할 수 있어야 한다.
- **AC-2 (시크릿):** WHEN 전체 Git refs를 검사할 때, gitleaks가 secret 값을 완전히 redact한 상태로 exit 0이어야
  하고 CI secret-scan은 full history checkout을 유지해야 한다.
- **AC-3 (현재 경로):** WHEN 현재 tracked text를 검사할 때, 구체적인 macOS/Linux/Windows 사용자 홈 절대경로가
  없어야 한다.
- **AC-4 (민감 파일):** WHEN tracked path를 검사할 때, `.env`·개인키·credential·keystore 유형이 없어야 한다.
- **AC-5 (공개 식별정보):** WHEN 프로젝트명·작성자 이메일을 발견할 때, 실제 공개 repo·공개 프로필인지 원본에서
  확인해 `PASS`, `ACCEPTED`, `FAIL`로 분류하고 비공개라고 추정하지 않아야 한다.
- **AC-6 (라이선스/provenance):** WHEN 배포 자산을 점검할 때, 루트 MIT LICENSE와 README 링크가 있고 vendored
  dependency가 없으며 바이너리 자산의 도입 commit·메타데이터·잔여 provenance 한계를 기록해야 한다.
- **AC-7 (발견성):** WHEN README나 제품 로드맵에서 감사를 찾을 때, 정본 보고서 링크와 완료 상태를 확인할 수
  있어야 한다.

## 4. 테스트 시나리오

- **정상:** 보고서·MIT LICENSE·README 링크·full-fetch gitleaks·민감 파일 0·절대 홈 경로 0이면 통과한다.
- **예외:** 보고서 또는 라이선스가 없거나, tracked `.env`/개인키가 있거나, CI가 shallow secret scan이면 실패한다.
- **경계:** `$HOME`·`~/path`·placeholder 경로는 이식 가능한 표기라 허용하고, 실제 사용자명이 포함된 절대 홈
  경로만 실패한다. 공개 프로젝트명과 공개 프로필 이메일은 자동 삭제하지 않고 근거와 함께 수용한다.

## 5. 제약 / 비기능

- 시크릿 값은 출력·보고서에 기록하지 않고 gitleaks `--redact=100`만 사용한다.
- 감사 명령 실패를 안전으로 해석하지 않는다. 도구 오류는 `UNVERIFIED`다.
- 문서·repo 내부 CI 계약만 변경하므로 harness-guard 버전은 0.58.0을 유지한다.

## 6. 경계 / Do-Not

- ✅ 해도 됨: 현재 문서의 개인 절대경로를 `$HOME`·placeholder로 일반화하고 감사 증거를 기록한다.
- ⚠️ 먼저 물어봐: 과거 commit의 개인정보 제거를 위한 force-push/history rewrite, 자산 삭제·교체.
- 🚫 절대 금지: 실제 secret 출력, 미확인 provenance를 확정으로 표현, 공개 식별자를 비공개 유출로 과장.

## 7. 기술 접근 (HOW)

- gitleaks 8.30.1 `git --log-opts="--all" --redact=100`으로 전체 refs의 내용 변경을 검사한다.
- Git 자체 명령과 텍스트 패턴으로 현재 tracked path·절대 홈 경로·히스토리 노출 빈도를 별도 검사한다.
- GitHub 원본에서 소비 repo visibility와 사용자 프로필 email 공개 여부를 확인한다.
- `docs/public-safety-audit.md`에 raw secret 없이 판정 근거와 한계를 남긴다.
- `tests/public-safety-audit-test.sh`가 현재 공개 baseline과 문서 연결을 CI에서 고정한다.

## 8. 태스크 (test-first 순서)

| # | 태스크 | AC 참조 | 대상 파일 | 검증(exit 0) | 의존 |
|---|---|---|---|---|---|
| 1 | 공개 baseline 계약 RED 작성·CI 등록 | AC-1~4,6~7 | `tests/public-safety-audit-test.sh`, `.github/workflows/ci-gate.yml` | 전용 테스트가 누락 항목으로 실패 | — |
| 2 | 현재 절대경로 제거 | AC-3 | 관련 문서 | 전용 테스트 경로 검사 | #1 |
| 3 | 감사 보고서·발견 경로 작성 | AC-1~7 | `docs/public-safety-audit.md`, `README.md`, `docs/product-direction.md` | 전용 테스트 GREEN | #1~2 |
| 4 | 전체 품질 검증·결정 기록·커밋 | AC-1~7 | 위 파일, `docs/decisions.md` | 전체 CI quality 재현 | #1~3 |
