# 오픈소스 공개 안전성 감사

이 문서는 Team Harness의 공개 안전성을 2026-07-18에 실측한 정본이다. 공개를 막는 결함과 공개해도 되는
식별정보를 구분하고, 검증하지 못한 부분은 한계로 남긴다.

## 감사 대상과 기준

- **기준:** `develop` commit `409312d16d1e051ec41091e7284391aeafe7d621`
- **Git 범위:** 전체 refs 696 commits. 이 중 merge-only·빈 변경을 제외한 내용 변경 350 commits를 스캔했다.
- **시크릿 도구:** gitleaks 8.30.1
- **민감정보 범위:** tracked 민감 파일명, 현재·과거 사용자 홈 절대경로, 프로젝트명, Git 작성자 이메일.
- **라이선스 범위:** 루트 LICENSE·README 연결, vendored dependency, binary asset의 도입 commit과 메타데이터.

시크릿 값은 다음과 같이 완전히 가린 상태로 검사했다.

```bash
gitleaks git --no-banner --redact=100 --log-opts="--all" \
  --report-format json --report-path /tmp/team-harness-gitleaks.json --timeout 120 .
```

## 검증 결과

| 축 | 판정 | 증거와 해석 |
|---|---|---|
| Git 히스토리 시크릿 | **PASS** | gitleaks exit 0, finding 0. 전체 refs의 내용 변경 350 commits 검사. |
| 민감 tracked 파일 | **PASS** | `.env`·개인키·credential·keystore 패턴 0개. |
| 현재 사용자 홈 절대경로 | **PASS** | 발견한 4곳을 `$HOME`·`~` 표기로 일반화한 뒤 tracked text 0개. |
| 과거 사용자 홈 절대경로 | **ACCEPTED** | macOS 홈 1종, 29회. 사용자명은 공개 GitHub handle이고 새 비밀을 포함하지 않는다. |
| 소비 프로젝트명 | **ACCEPTED** | `erp`·`siku`·`webhook-service`·`drivertree`는 2026-07-18 GitHub 원본에서 모두 PUBLIC 확인. |
| Git 작성자 이메일 | **ACCEPTED** | 발견한 Gmail 주소는 같은 날짜 GitHub 공개 프로필의 공개 email과 일치. |
| 프로젝트 라이선스 | **PASS** | 루트 MIT `LICENSE`와 README 링크 존재. |
| dependency provenance | **PASS** | lockfile·`vendor/`·`third_party/` 디렉터리와 별도 저작권 표식 0개. |
| binary asset provenance | **ACCEPTED** | `docs/architecture.png`와 `docs/architecture-gitflow.png`는 commit `a6164f1`에서 함께 도입. 외부 attribution 및 artist·copyright·software 내장 메타데이터 0개. |
| CI 지속 검사 | **PASS** | `secret-scan`이 `fetch-depth: 0` checkout 뒤 gitleaks action 실행. |

공개 프로젝트명과 공개 프로필 이메일은 식별정보이지만 비공개 정보는 아니다. 이를 자동 삭제하면 결정의 근거와
실제 소비 관계를 훼손하므로 공개 여부를 원본에서 확인한 뒤 수용했다.

## 조치 사항

- 현재 문서의 구체적 사용자 홈 절대경로 4곳을 `$HOME` 또는 `~` 기반 표기로 교체했다.
- 민감 파일·절대 홈 경로·MIT LICENSE·README 링크·CI full-fetch gitleaks 계약을
  `tests/public-safety-audit-test.sh`로 고정했다.
- README와 제품 로드맵에서 이 보고서를 찾을 수 있게 연결했다.
- 플러그인과 소비 repo의 실행 동작은 바꾸지 않아 harness-guard 버전은 0.58.0을 유지한다.

## 잔여 위험과 한계

- gitleaks는 알려진 패턴과 entropy 기반 탐지다. finding 0이 모든 임의 형식의 비밀 부재를 수학적으로 증명하지는
  않는다. 새 규칙과 GitHub secret scanning을 계속 병행한다.
- 과거 절대경로 29회는 Git 히스토리에 남는다. 공개 handle 외 추가 비밀이 없고 repo가 이미 public이므로,
  효과가 제한적인 history rewrite와 force-push는 수행하지 않았다.
- Git commit과 PNG 메타데이터만으로 두 다이어그램의 창작 과정을 완전히 증명할 수는 없다. 외부 출처의 자산을
  추가할 때는 출처·라이선스·변경 여부를 같은 PR에 기록해야 한다.
- 감사 기준 이후 변경은 CI baseline과 향후 release-check로 다시 검증해야 한다.

## 최종 판정

**공개 차단 결함 없음 — 오픈소스 공개 상태 유지 가능.**

시크릿 finding, 비공개 프로젝트명, 라이선스 누락, 출처가 확인된 제3자 무허가 자산은 발견되지 않았다. 위 잔여
한계는 공개를 막지는 않지만, 향후 자산·규칙 추가 시 provenance와 full-history secret 검사를 반복해야 한다.
