# Changelog

<!-- Generated file. Do not edit release entries manually. -->

Generated from version tags, a pre-tag release candidate, and Conventional Commits (`feat` and `fix` only).
Regenerate with `node scripts/generate-changelog.mjs --release v0.61.0` and replace this file with its output.

## v0.61.0 - 2026-07-24

- fix(security): backtick egress substitution 차단
- fix(release): 태그 후 changelog byte 재현 보장
- fix(release): pipeand와 후보 날짜 재현성 보강
- fix(security): 경로 포함 env 원격복사 차단
- fix(security): builtin egress dispatcher 차단
- fix(security): 감사로그와 netcat 경계 보강
- fix(release): v0.61.0 최종 게이트 강화
- fix(security): sh -c option separator 처리
- fix(security): prefixed shell wrapper egress 차단
- fix(security): Unix continuation을 LF로 한정
- fix(security): 셸 continuation 의미론 보존
- fix(security): v0.61.0 릴리즈 게이트 우회 차단
- fix(codex): routing 증거 응답 형식 고정
- fix(codex): 다중행 hook 증거 정규화
- fix(codex): live attestation 독립 검증
- fix(codex): pilot 경로 증거 비식별화
- fix(codex): pilot 한계 보고 재현
- fix(codex): 릴리즈 증거 trust chain 강화
- fix(migration): 테스트 fixture 발견 제외
- fix(ci): pilot 증거 검증에 전체 이력 제공
- fix(codex): 네이티브 증거 검증 강화
- feat(codex): 네이티브 loader로 전환

## v0.60.0 - 2026-07-19

- fix(release): changelog 종단 newline 정규화
- fix(profile): 설치 provenance를 단일 SHA에 고정
- fix(profile): symlink 경로 doctor 검증 보장
- fix(release): bundle provenance를 단일 SHA에 고정
- fix(security): 경합 대상 identity 고정
- fix(security): 릴리즈 후보 경계 검증 강화
- feat(pilot): 외부 repo 읽기 전용 측정 runner 추가
- feat(compat): plugin clean-session 공존 검증 추가
- fix(release): bundle dirty-worktree 반례 자기오탐 제거
- feat(release): 오픈소스 공개 계약과 재현 bundle 추가
- fix(profile): generation cleanup을 commit 결과와 분리
- fix(profile): generation과 package 전수 경계 검증
- fix(profile): stale 관리 profile 제거 허용
- fix(profile): disable을 active package view에 반영
- fix(profile): binding 해소와 generation 교체 보장
- fix(profile): mutation 원자성과 profile 계약 검증
- fix(profile): symlink state와 catalog drift 차단
- fix(profile): 변조된 package 제거 경로 차단
- feat(profile): 설치 수명주기와 doctor 추가

## v0.59.0 - 2026-07-18

- fix(ci): Action pin 검사 런타임 호환
- fix(review): YAML alias Action 검사 지원
- fix(security): stack 실행 권한과 YAML pin 우회 제거
- fix(review): Action uses 스칼라 경계 파싱
- fix(security): 실행기 권한과 Action pin 우회 차단
- fix(review): quoted Action 값 파싱 보강
- fix(security): 자식 명령 자동허용 우회 차단
- fix(security): 자동허용 우회와 복구 재시도 보강
- fix(review): solo 스레드 검증 경로 통합
- fix(review): 페이지 메타데이터 검증 강화
- fix(security): 릴리즈 보안 게이트 하드닝
- fix(packaging): strict SemVer 검증 보강
- feat(packaging): 제품 package artifact 분리
- feat(boundary): 제품 설치 운영 경계 확정
- feat(audit): 플랫폼 중복 책임 경계 확정
- feat(audit): 공개 안전성 baseline 확정
- feat(direction): 제품 방향 판단 게이트 정립

## v0.58.0 - 2026-07-17

- fix(loop): timeout 실행 계약 보강
- fix(loop): fingerprint 시간 경계 보강
- feat(harness): Codex 갱신과 fingerprint 메모리 개선

## v0.57.0 - 2026-07-17

- fix(loop): parent symlink race 차단
- fix(loop): symlink fingerprint 차단
- fix(commit): merge provenance 우회 차단
- fix(workflow): 릴리즈 보안 우회 차단
- fix(commit): pull merge 메시지 허용
- fix(commit): Node 없는 로컬 훅 허용
- fix(commit): 다중 브랜치 머지 허용
- fix(loop): 성공 체크포인트 원자성 보장
- fix(commit): 생성 메시지 예외 범위 축소
- fix(sync): 커밋 강제 체인 검증
- fix(sync): validator 정본 일치 검증
- fix(loop): phase별 플러그인 경로 복구
- fix(loop): 수정 파일 누적 보고 보완
- feat(workflow): AI 작업 표준화 강화

## v0.56.0 - 2026-07-16

- feat(skills): 완료 전 검증 게이트 추가
- feat(skills): 체계적 디버깅 계약 추가

## v0.55.2 - 2026-07-15

- fix(doctor): 보호 브랜치 누락을 실패 처리
- fix(codex): smoke 훅 증거 판정 강화
- feat(doctor): 런타임 상태 종합 진단 추가
- feat(codex): fresh-session hook smoke 추가

## v0.55.0 - 2026-07-12

- feat(codex): 모든 로컬 surface에 hook 경로 강제

## v0.54.1 - 2026-07-12

- fix(codex): skill cache 경로 변환 멱등성 복구

## v0.53.0 - 2026-07-12

- fix(codex): guard runtime 감사 경로 격리

## v0.52.0 - 2026-07-12

- fix(codex): 소비 repo stack rule 전달 배선

## v0.51.0 - 2026-07-12

- fix(codex): 모델 티어링을 사용자 플랜에 맞춤

## v0.50.0 - 2026-07-11

- feat(skills): Codex 실행 계약 가시성 강화

## v0.49.0 - 2026-07-11

- fix(codex): unified exec hook 우회 차단

## v0.48.0 - 2026-07-11

- fix(repo-sync): self-repo 배포 자산 스택 오탐 제거

## v0.47.0 - 2026-07-11

- fix(codex): attribution 제거 시 닫는 따옴표 보존
- feat(codex): plugin cache 버전 드리프트 자동 해소

## v0.46.0 - 2026-07-11

- fix(codex): Claude 공동작성 오귀속 제거

## v0.45.0 - 2026-07-11

- feat(codex): 시작 전 보안 cache 자동 복구

## v0.44.0 - 2026-07-11

- fix(codex): skill cache 실행 메타데이터를 정규화

## v0.43.0 - 2026-07-11

- fix(codex): security guidance cache refresh를 보정

## v0.42.0 - 2026-07-11

- fix(codex): 현재 플랜의 모델 tier를 반영
- feat(codex): 스킬과 에이전트 parity를 확장

## v0.41.0 - 2026-07-10

- fix(codex): pretool hook을 단일 경로로 정규화

## v0.40.0 - 2026-07-10

- fix(codex): exec hook payload를 지원

## v0.39.0 - 2026-07-10

- fix(ci): skill mapping 테스트 의존성을 제거
- fix(ci): parity matrix 테스트 의존성을 제거
- fix(ci): cache patch 테스트 의존성을 제거
- fix(codex): 환경 변수 유출을 차단
- feat(codex): 스킬 실행 규칙을 매핑
- fix(codex): 구버전 cache 패치를 거부
- feat(codex): 시크릿 외부 전송 가드 추가
- fix(codex): Codex cache 훅·스킬 로드 경고를 보정
- fix(codex): preserve security-guidance via adapter
- fix(skills): quote Codex-incompatible frontmatter hints
- fix(settings): .env-리더 Bash deny 보강으로 Read deny 우회 차단 + 위협모델 명문화 (#237)
- fix(ddl-gate): '#' 라인주석 분리·TRUNCATE() 오탐 봉쇄를 SQL·Alembic 게이트에 backport (#258)
- fix(rails-stack): 적대적 재검증 발견 봉쇄 — AR 게이트 4건 + test-guard MARKER 오탐
- feat(rails-stack): AR 파괴 DDL 게이트 구현 (T4, GREEN, AC-1~11)
- feat(rails-stack): rspec/minitest test-guard — 삭제-차단 + MARKER (T2, AC-12·13)
- feat(rails-stack): ruby.md rules — RuboCop·보안·rspec + AR 마이그레이션 안전 (T1, AC-14)
- fix(alembic-ddl): 코드리뷰 반증 발견 12개 우회/오탐 봉쇄
- feat(alembic-ddl): Alembic .py upgrade() 파괴 DDL 정적 게이트 (GREEN)

## v0.31.0 - 2026-07-08

- fix(guard): 파괴 DDL 게이트 블록주석 우회 봉쇄 — /* */ 토큰 병합 방지
- fix(guard): verifier 적대적 재검증 반영 — yarn 오라우팅 홀 봉쇄·bare spec/ 제외 (#245)
- feat(guard): 전역설치 게이트를 패키지매니저-인식으로 일반화 (#245 태스크2)
- feat(guard): 검증기-삭제 게이트 커버리지 확장 — jest·복수형 migrations·rspec (#245 태스크1)
- feat(guard): 파괴 DDL 게이트를 소비 repo에 전파 (L3 풀 패리티)
- feat(guard): 파괴적 DDL 정적 게이트 — 마이그레이션 SQL의 비가역 데이터-손실 차단
- fix(guard): validator 파일패턴 종단앵커 제거 — glob/접미 홀 봉쇄 (2차검증)
- feat(guard): 순수 bash 셸 토크나이저 primitive + 단위 테스트
- fix(migration-safety): scheme 주석 추출을 따옴표 인식으로 (리뷰 2차)
- fix(migration-safety): scheme 선언을 ooo와 동일 신뢰 스코프로 (리뷰 반영)
- feat(migration-safety): #2 선택적 scheme 선언 — 촘촘밴드 정밀 판정 (태스크3)
- fix(migration-safety): #1 nearest-config 모듈 partition — greedy 교차크레딧 차단 (태스크2)
- fix(migration-safety): #3 타임스탬프 판정을 자릿수→실제 날짜형식으로 (태스크1)
- fix(harness-guard): solo-merge python3-degraded 시 복구 fail-closed + jq 폴백 (리뷰 반영)
- feat(harness-guard): solo-merge pre-gate 이관 — DELETE 이전 차단 (태스크3)
- feat(harness-guard): solo-merge 원자 코어 — trap EXIT/INT/TERM/HUP 복구 보장 (태스크2)
- feat(harness-guard): solo-merge 순수 판정 함수(had_protection·extract_restore_payload) + 단위테스트 (태스크1)
- fix(harness-guard): guard.sh python3 fail-closed 폭발반경 축소 — jq 폴백 (v0.29.23)
- fix(harness-guard): set-branch-protection --check에 allow_force_pushes·allow_deletions 검증 추가 (v0.29.22)

## v0.29.21 - 2026-07-07

- fix(skills): back-merge 충돌 해소 대상 브랜치 정정 + sync 브랜치 정리 (#230)
- fix(test): enforce-subagent-model 테스트 mktemp 이식성 (Linux CI)
- fix(harness-guard): migration 파일명 필터 safe-default화(High) + #214/#223 과장주장 정정 (v0.29.20)
- fix(harness-guard): migration 괄호부정 false-pass 부분교정 + #224 서브셸 종단 되돌림 (v0.29.19)
- fix(harness-guard): force-push 서브셸 우회 종단 교정 + guard-matrix 과장 주장 정정 (v0.29.18)
- fix(harness-guard): 마이그레이션 복합 프로파일 false-pass 교정 — #214 주장 반증 후 재수정 (v0.29.17)
- fix(harness-guard): new-repo 권한병합 실패 exit 반영(Med) + pr-create self-PR 거절(Low) (v0.29.16)
- fix(harness-guard): 마이그레이션 프로파일 적용성을 safe-default로 전환(High) (v0.29.15)
- fix(harness-guard): check-repo-sync 주석 스트립 따옴표-인식 교정(High 회귀) + gradlew check (v0.29.14)
- fix(harness-guard): route-intent committed 판정 base를 develop 우선으로 교정 (v0.29.13)
- fix(harness-guard): 자기-회귀 교정(guard High) — 다중-push force 우회 + 대문자 URL 마스킹 (v0.29.12)
- fix(harness-guard): 자기-회귀 교정(guard) — force 과탐 + reset wrapper 우회 + 명시refspec 오차단 (v0.29.11)
- fix(harness-guard): 자기-회귀 교정(mjs) — migration !test false-FAIL + repo-sync 인라인# false-MISSING (v0.29.10)
- fix(harness-guard): 게이트 견고성 3건 — strict 감사 + alembic 임계값 바인딩 + classify_ci 상태컬럼 (v0.29.9)
- fix(harness-guard): hotfix/release back-merge 실행가능화 + loop stuck 감지 교정 (v0.29.8)
- fix(harness-guard): 마이그레이션 게이트 프로파일 적용성 의미론 판정 (v0.29.7)
- fix(harness-guard): LITE 교차오염 + npm=값 우회 + force-push refspec 하드닝 (v0.29.6)
- fix(harness-guard): 스킬 정합성 2건 — pr-create 오라우팅 + release-check Alembic 오탐 (v0.29.5)
- fix(harness-guard): commitlint type-enum을 정본 code-review.md와 정합 (v0.29.4)
- fix(harness-guard): check-repo-sync sentinel 매칭 전 주석 제거 (v0.29.3)
- fix(harness-guard): 마이그레이션 게이트 단일파일 다중 프로파일 false-pass 차단 (v0.29.2)
- fix(harness-guard): route-intent isSolo를 PR base 브랜치 protection으로 판정 (v0.29.1)
- fix(harness-guard): 가드 우회 잔여 8건 정규식 일반화 + fail-closed 강화 (v0.29.0)

## v0.28.1 - 2026-07-06

- fix(harness-guard): 훅 fail-open 계약 복원 + 감사 로그 테스트 격리 (v0.28.1)

## v0.28.0 - 2026-07-06

- fix(harness-guard): 감사 로그 위조(log forging) 방지 — repr 이스케이프
- feat(harness-guard): 서브에이전트 모델 티어링 DEFAULT 계층 추가 (v0.28.0)

## v0.26.0 - 2026-07-05

- feat(harness-guard): 모델 티어링 훅·verifier 에이전트 플러그인 승격 (versioned+tested)

## v0.25.0 - 2026-07-05

- feat(guard): repo-level .harness-lite 면제 (dev git-flow opt-out, 안전가드 유지)

## v0.24.2 - 2026-07-05

- feat: /repo-sync 아키텍처 다이어그램 소스 점검 (v0.24.2)
- fix: new-repo 부트스트랩 데드락 — 워크플로 push 전 보호 보류 (v0.24.2)
- fix: 템플릿 생성기 ruff CI 가드 — 재-오염 방지 (v0.24.1 후속)

## v0.24.1 - 2026-07-05

- fix: 템플릿 생성기 ruff-clean — python repo 복사 시 CI 통과 (v0.24.1)

## v0.24.0 - 2026-07-05

- feat: 아키텍처 다이어그램 자동재생성 훅 표준화 (v0.24.0)

## v0.23.0 - 2026-07-05

- feat: pr-merge 머지 후 로컬 head 브랜치 자동 정리 (v0.23.0)

## v0.22.2 - 2026-07-05

- fix: stale /goal 스킬 dir 제거 — #31 rename 완결 (v0.22.2)

## v0.22.1 - 2026-07-05

- fix: set-branch-protection arg 파서 하드닝 — 값 없는 --approvals/--contexts 무한루프 방지 (v0.22.1)

## v0.22.0 - 2026-07-05

- feat: 팀 모드 브랜치 보호 — set-branch-protection.sh --approvals N (v0.22.0)

## v0.21.2 - 2026-07-05

- fix: 감사 잔여 정리 — intro.html AI리뷰 축 drift + route-intent T4 seam (0.21.2)

## v0.21.1 - 2026-07-05

- fix: 플러그인 스킬 발견성 — skill.md → SKILL.md (하네스 스킬 강제 복구, v0.21.1)

## v0.21.0 - 2026-07-04

- fix: guard 커밋 정규식 우회 회귀 재봉쇄 — commit 앞 임의 전역옵션 (릴리즈 보안검토 A5b)
- fix: 자동머지 안전계약 강화 — --auto fail-closed + --contexts 리메디에이션 (감사 F 후속, v0.21.0)
- feat: provisioner↔verifier 대칭 + v0.20.0 감사 릴리즈 (감사 T5, P5, E1~E4)
- fix: 안전 게이트 fail-open/침묵실패 4건 (감사 T3, P2)
- fix: guard.sh 정규식 우회 4 + 과차단 1 수정 (감사 T2, P1)
- feat: develop 전용 자동머지(--auto) — CI-green develop PR 무프롬프트 머지 (개선2)
- fix: 브랜치 보호 enforce_admins false→true — CI-green 서버 강제(우회불가)
- fix: 백로그 정리 — E4 다이어그램 포맷 정본(mermaid→PNG) + S2 migration-safety 짝-플래그 (#116)

## v0.19.1 - 2026-07-04

- fix: 브랜치 보호 표준을 솔로(승인0·CI-gate)로 정합 + set-branch-protection 도구 (v0.19.1) (#114)

## v0.19.0 - 2026-07-04

- fix(skills): milestone S2·B2도 커밋 제거 — K3 완결(진행률·분해도 로컬 대시보드)
- fix: solo-merge 보호 손실복원 봉쇄(K1) + 스크립트 견고성(S3·S4)
- fix(skills): 메타 산출물 커밋 제거(GitHub 정본) + skills↔guard 충돌 해소 (K2~K5)
- fix: migration-safety false-pass 봉쇄(S1) + ci-gate에 게이트 테스트 배선(T1)
- fix(guard): 엔지니어링 리뷰 guard 하드닝 5건 (G1~G5)
- fix: E2 onboarding public 전환 반영 + E7 feature-merge 중복 원격삭제 제거
- fix: 감사 코드 하드닝 (F6 route-intent 부정문 veto, F7 merge-permissions 무진단 skip)
- fix(harness-review): release-check·commands 경로 이전 반영 — 엔진 dead reference 수정 (감사 F1·F2·E9)
- fix(ci): integration-e2e job명을 required check명과 일치 (감사 E1)
- feat(guard): feature 브랜치 진입 시 상류 plan 아티팩트 강제 (v0.18.0, 감사 F5)
- feat(release-check): Agent A에 아키텍처 SVG 신선도 점검 추가

## v0.16.4 - 2026-07-03

- fix(check-repo-sync): 상대경로 '--repo .' 시 workflow 파일 미감지 버그 수정

## v0.16.3 - 2026-07-03

- feat(route-intent): 오버트리거 방지 회귀 테스트 AC-2i~k 추가 + v0.16.3

## v0.16.1 - 2026-07-03

- fix(route-intent): v0.17.0 리버트 + team-harness public 전환 결정 기록
- feat(route-intent): 전-스킬 라우팅 확장 4→12 라우트 (v0.17.0)

## v0.15.0 - 2026-06-30

- feat(korean-ux): 한국어 UI/UX 표준 신설 — 용어집·마이크로카피·폼포맷 + qa Agent C
- feat(stacks): Vue·Next.js 1급 지원 — new-repo case 7·8 + 전용 CI·룰·권한
- fix(skills): 스크립트 참조 이식성 — 절대경로→CLAUDE_PLUGIN_ROOT 폴백형

## v0.14.2 - 2026-06-30

- fix(guard): 차단 로그 시크릿 마스킹 (v0.14.2)
- fix(guard): | 분리자를 공백 동반 시에만 인정 — verifier 적발 바이패스 차단
- fix(guard): | 오탐 제거 + feature-merge 래퍼 직접참조 통일 (v0.14.1)
- fix(harness): pr-merge CHECKS_RC set -e 함정 — || 로 RC 흡수
- fix(harness): pr-merge CI 게이트가 checks API 토큰 제한 시 Actions run 폴백
- fix(harness): pr 래퍼 코드리뷰 반영 — 스레드 게이트 fail-closed 등
- feat(guard): 맨손 gh pr create/merge 차단 + PR 래퍼 스크립트 (v0.14.0)
- fix(ci): ci-gate를 develop PR에도 트리거 — team-harness develop 채택 준비
- fix(harness): pr-create base 감지 코드리뷰 반영 — tail 오탐·오프라인 오판·detached 가드
- feat(harness): pr-create — base 자동감지 PR 생성 프리미티브 (v0.13.0)
- fix(harness): merge-permissions 코드리뷰 반영 — 원자적 쓰기·trim·견고성
- feat(harness): 커밋 settings.json을 dev 권한 단일출처로 — 공통 베이스라인 + 스택 병합 (v0.12.0)
- fix(harness): 의도 라우터 코드리뷰 반영 — 오버트리거·상태수집 버그 수정
- feat(harness): 의도 라우터 — UserPromptSubmit 훅으로 캐주얼 지시→스킬 라우팅 (v0.11.0)
- feat(harness): guard 차단 이력 로깅 — deny() 중앙화 + guard-block.log (v0.10.2)
- fix(harness): 추적 오포함 파일 정리 — .DS_Store·intro.html untrack + .gitignore 추가
- fix(harness): 서브에이전트 타입↔티어 정합 — 헬스체크 Explore화 + 마이그레이션감사 sonnet 정정 (v0.10.1)
- feat(harness): /repo-sync 스킬 + check-repo-sync 플러그인 이전(루트 shim 호환) + v0.10.0
- feat(harness): repo-sync 워크플로 env-gate + 토큰 활성화
- fix(harness): check-repo-sync의 ci-gate 오탐 수정 (ci.yml 인식)
- feat(harness): 기존 repo 드리프트 점검(check-repo-sync) + ci-gate 하드코딩 정리 + v0.9.0
- fix(harness): 게이트 결함 수정 — migration-safety path-filter 트랩·비-Flyway 정직화·보안/배포/격리 갭 + v0.8.0
- feat(harness): 품질 교훈을 메커니즘으로 승격 — 마이그레이션 안전성 게이트·게이트 스킬 강화·템플릿 기본값
- fix(commitlint): config를 .cjs로 — ESM 컨테이너/리포에서 module.exports 깨짐 수정
- feat(harness): preflight 선독·검증기 삭제 차단·commitlint 추가 — 표준 강제를 메커니즘으로. guard.sh가 테스트/마이그레이션 삭제 차단, /plan·/feature-add가 설치된 API 선독 강제.
- feat(stacks): 스택별 공식 포매터/린터를 빌드 게이트로
- fix(ci): ai-review를 구독 OAuth 토큰으로 전환 + 토큰 없으면 통과
- feat(templates): 배포 Dockerfile 템플릿 + AGENTS.md 헬스체크 섹션 추가
- feat(harness): milestone·loop 스킬 추가, plan에 plan mode 흡수
- fix(skills): disable-model-invocation 전체 제거
- fix(solo-merge): enforce_admins 토글 → required_pull_request_reviews 삭제·복구 방식으로 교체
- fix(standards): CI/Docker 이미지 기준 Corretto로 통일 (temurin 제거)
- fix(review): id-token 제거, --watch --required 적용, spring 가드 패턴 변경
- fix(new-repo): mkdir -p backend before copy_once for Spring stack files
- fix: Opus 리뷰 지적사항 반영 (9건 중 8건)
- fix: Spring 프로젝트 온보딩 누락 파일·안내 추가
- fix(template): ai-review.yml id-token:write 권한 추가
- fix(docs): AI 온보딩 가드레일 추가
- feat(skills): disable-model-invocation + effort 레벨 추가
- feat(harness): 스택별 rules 템플릿 추가 + new-repo.sh 통합
- feat(plugin): commands/ → skills/ 전환 (공식 권장 구조)
- feat(ci-gate): 스택별 ci-gate 템플릿 6종 + new-repo.sh 스택 선택 메뉴
- feat(onboarding): new-repo.sh 스크립트로 신규 repo 셋업 자동화
- fix(plan): /plan에서 git 제거 — 계획 전용으로 정정 + A모델·롤백 설계
- feat(plan): /plan 커맨드 추가 — AI 실행용 스펙·플랜·태스크 정리 (v0.6.0)
- feat(harness-guard): /solo-merge 커맨드 추가, v0.5.0
- feat(harness-guard): 설계 검토 lens 추가 (clean-arch 본질 + SOLID-judicious), v0.4.0
- feat(harness-guard): TDD 커맨드(feature-add/modify) + qa 일반화 추가, v0.3.0
- feat(pr-review-gate): PR 단계 AI 리뷰를 /code-review로 전환
- fix(ci): actions checkout·setup-node v5 — Node 20 강제 전환(2026-06-16) 대응
- fix(release): Phase 2 조건화 + release 브랜치 추가 커밋 재검증 규칙
- fix(guard): siku 실측 수정 백포트 — fail-closed·rm 단어경계·CI 권한
- fix(guard): 차단 메시지를 stderr로 출력 — PreToolUse 프로토콜 준수
- fix: rm -rf 가드에 심링크 경로 정규화 추가
- fix: docs↔하네스 심층 정합성 검토 확정 19건 수정
- fix: rm -rf 가드의 PROJECT_ROOT 정규식 메타문자 이스케이프
- fix: 워크플로 정합성 검토 확정 8건 수정
- fix: 전체 검토 발견사항 정합화 — 팀 환경 기준으로 git-flow 절차 재작성
- fix: 파일럿 드릴 발견사항 반영
- feat: git 네이티브 pre-commit 가드 추가 (계층 0.5)
- fix(guard): cd 우회 차단 + 시크릿 prompt 훅 오탐 완화
- feat: team-harness v0.1 스캐폴딩 — 마켓플레이스 + harness-guard 플러그인 + 템플릿
