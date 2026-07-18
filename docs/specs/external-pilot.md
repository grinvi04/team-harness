# 외부 파일럿 측정 스펙

## 1. 목표 & Why

독립 소비 프로젝트에서 Team Harness profile 설치 시간, guard 표본 오탐·누락, repo 표준 유지보수 비용을
재현 가능하게 측정해 제품 방향을 다시 검증한다. 첫 대상은 clean `develop`의 공개 소비 repo DriveTree다.
**성공 기준: 대상 repo 전후 status·HEAD가 불변이고, 구조화된 측정 결과와 한계를 저장소에 기록한다.**

제품 방향 판정은 **연결**이다. 소비 repo의 앱·배포를 소유하지 않고 governance profile과 해당 repo의
Git/CI 증거 사이를 읽기 전용으로 측정한다.

## 2. Scope

- **In:** clean Git repo preflight; 임시 `agent-governed/codex` profile install·doctor 시간; repo-sync
  OK/WARN/MISSING 집계; 정상 허용·정책 차단 guard probe; 전후 Git status·HEAD 불변; JSON report와 Markdown 판정.
- **Out:** 소비 repo 파일·브랜치·GitHub 정책 변경; 앱 dependency 설치·build/test/deploy; 실제 사용자
  cache/config 변경; marketplace 공개; 표본 밖 전체 정확도 주장.

## 3. 수용기준

- **AC-1 (preflight):** IF 대상이 Git repo가 아니거나 dirty/detached이면, runner SHALL profile·probe 전에
  non-zero로 종료한다.
- **AC-2 (설치 측정):** WHEN clean repo를 측정하면, runner SHALL 임시 경로에 profile을 설치하고 doctor가
  healthy인지 확인하며 install·doctor duration을 0 이상의 millisecond로 기록한다.
- **AC-3 (드리프트 비용):** runner SHALL repo-sync 출력에서 stack과 OK/WEAK/WARN/MISSING 개수를 수집하고
  exit code를 원본 그대로 기록한다.
- **AC-4 (오탐 표본):** benign read/build-shaped 명령 네 개가 guard에서 허용되는지 측정하고 예상 밖 차단
  수를 sample false positive로 기록한다. 명령 자체는 실행하지 않는다.
- **AC-5 (누락 표본):** protected-branch commit, hard reset, force push, global install, test deletion 다섯
  명령이 차단되는지 측정하고 예상 밖 허용 수를 sample false negative로 기록한다.
- **AC-6 (비변경):** runner SHALL guard 대상 명령과 외부 repo 코드를 실행하지 않고, 종료 전 repo HEAD와
  porcelain status가 preflight와 byte-identical인지 확인한다.
- **AC-7 (보고):** JSON은 repo basename·remote·branch·commit·timestamp, durations, drift, probe counts,
  한계를 포함하며 사용자 home 절대경로·환경변수·secret을 포함하지 않는다.
- **AC-8 (판정):** Markdown은 측정값, 검증/추론 구분, 잔여 위험과 다음 결정을 기록하며 표본 0건을 전체
  호환성 0%로 표현하지 않는다.

## 4. 제약 / Do-Not

- Node.js 내장 모듈과 team-harness의 기존 manager·doctor·repo-sync·guard만 사용한다.
- 임시 profile은 OS temp 아래 생성·정리하며 target repo에는 쓰지 않는다.
- guard probe는 JSON을 stdin으로 전달해 판정만 받고 명령을 실행하지 않는다.
- 외부 repo의 AGENTS·stack rules를 읽되 파일럿 때문에 수정하지 않는다.

## 5. 태스크

| # | 태스크 | AC | 대상 | 검증 |
|---|---|---|---|---|
| 1 | runner 정상·실패·비변경 계약 RED | AC-1~7 | `tests/external-pilot-test.sh` | `bash tests/external-pilot-test.sh` |
| 2 | 최소 측정 runner 구현 | AC-1~7 | `scripts/run-external-pilot.mjs` | 동일 테스트 |
| 3 | DriveTree 실측·판정·CI·로드맵 반영 | AC-7~8 | `docs/pilots/`, `docs/`, CI | 전체 quality gate |
