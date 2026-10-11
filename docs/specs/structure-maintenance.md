# 저장소 구조 정리

## 승인 범위와 기준

사용자는 최신 develop에서 중복 설정·스택 템플릿·실험·과거 기록을 순서대로 정리하도록 승인했다.
시작 후보는 `85338bdcb691727ebd098f4ee0ce5167faf36e24`다.
목표는 설정 하나를 바꿀 때 정본 하나를 수정하고, 생성물과 직접 소비자의 영향을 확인할 수 있게 하는 것이다.
제품 방향 판정은 **소유**다. 기존 재사용 구성과 검사 연결을 정리하며 실행 플랫폼 기능을 추가하지 않는다.

기존 플러그인 하나와 공개 설치 경로를 유지한다. 가드·시크릿 검사·브랜치 보호·필수 CI를 완화하지 않는다.
새 스택, 앱 생성기, 분리 플러그인 발행, 전역 설정 변경, 소비 프로젝트 원격 작업·배포·결제는 제외한다.
Claude 인증 갱신·실제 모델 호출도 보류한다. 기본 작업 폴더와 다른 worktree는 보존한다.

## 작업 순서와 정본

1. **책임과 읽기 경로:** 현재 설치 파일, 신규 프로젝트 템플릿, 실험, 과거 증거를 구분한다.
   `docs/repository-structure.md`에서 수정할 정본과 생성물·검사 명령을 안내한다.
2. **중복 설정:** Git/CI 필수 배치 사본은 템플릿에서 생성하고 drift를 거부한다.
   내용이 빈 스택 권한 fragment와 신규 셋업의 무효 병합을 제거한다.
   명시적인 사용자 fragment를 병합하는 기존 CLI는 호환을 유지한다. 실행기 자동 허용을 추가하지 않는다.
3. **스택 템플릿:** 개별6개의 CI·rules·검사 이름을 하나의 카탈로그에서 관리한다.
   공통 workflow·시크릿 검사와 개별 job을 정본으로 두고 완성 YAML을 생성한다.
   풀스택 고정 파일을 없애고 백엔드4종×프론트3종을 조합한다. 검사 명령·action SHA는 보존하며
   두 작업 경로·Node cache·Ruby setup 경로만 조합에 맞춘다. 필수 검사와 두 rule을 함께 전달한다.
   DB는 기존 Prisma/Flyway/Alembic 연결을 유지하며 제품별 자격증명과 앱 설정은 제품에 남긴다.
4. **실험과 역사:** 분리 패키지 카탈로그·구현을 `experiments/`로 모은다.
   기존 명령과 import 소비자는 필요할 때 얇은 진입점으로 연결한다.
   과거 증거는 Git 고정 커밋85338bd에 보존하고 중복 checkout 파일만 삭제한다.
   직접 reader·참조와 복구 안내를 함께 갱신한다. 분리 패키지는 계속 `installable: false`다.
5. **통합 검증:** 현행 사용 안내·스펙·지도와 실제 후보를 맞추고 고정 후보를 독립 검토한다.

## 수용 기준과 확인 방법

| 기준 | 확인 |
|---|---|
| 정본 변경이 모든 배치 사본에 반영됨 | 생성 후 `--check` PASS, 사본 변조 시 FAIL, 재생성 결정성 |
| 개별6개 CI의 동작 유지 | 시작 후보 YAML과 생성 YAML의 byte·permissions·trigger·action SHA 대조 |
| 조합과 rule·경로 연결 일치 | 실제 new-repo의 개별6개·조합12개·사용자 경로·잘못된 역할/경로 시험 |
| 기존 프로젝트 파일 보존 | 기존 CI/settings/rules sentinel이 셋업 후 그대로 유지됨 |
| 자동 허용 범위 불변 | 기본 settings 유지, 무효 fragment 제거, 사용자 fragment CLI 시험 유지 |
| 실험 경로와 공개 설치 분리 | package/profile/bundle/pilot fixture 검사, 공개 marketplace 불변 |
| Git 역사와 reader 연결 유지 | 삭제한 증거의 고정 Git blob·참조 경로 대조, provenance fixture 검사 |
| 보호 기능 회귀 없음 | 현 후보 quality 잡 전체, 거부·경계 시험, 읽기 전용 독립 검토 |

최초 실패는 당시 후보·명령과 함께 보존한다. 새 변경·가설 없이 같은 실패를 반복하지 않는다.
전체 CI와 실제 소비 앱의 원격 실행·배포는 별개다. 구현·병합·발행·Harness 설치를 구분한다.
수용 기준이 충족되면 종료한다. 새 개선 항목을 완료 조건에 추가하지 않는다.

## 진행 기록

- 준비: 기본 폴더의 최신 develop 일치와 사용자 worktree 보존을 확인했다.
- 구현: 전용 worktree에서 정본·생성물·스택 카탈로그·실험·역사 이동을 구현했다. 후보 버전은 0.88.0이다.
- 범위 검사: 실제 셋업 28항목, 스택 생성·선택 9항목, 권한 CLI 9항목과 배치 사본 검사를 통과했다.
  시작 CI 8파일은 생성 안내 한 줄 외 바이트 동일하다. 역사 772파일의 Git blob도 시작 후보와 동일하다.
- 최초 셋업 반례: 카탈로그 연결 전 후보에서 22 PASS/6 FAIL이었다.
  Vue/Next.js rule 누락·잘못된 프론트 선택 미거부·기존 settings 재작성에 대응해 연결을 수정했다.
  worker가 발견한 macOS CLI 실경로와 stdin import 오류도 진입점 판정에서 수정하고 재검사했다.
- 첫 전체 quality: 커밋 132f81a에서 19번째 단계가 예전 Bash append 문구를 찾는 정적 단언으로 멈췄다.
  trusted workflow 자체의 62항목은 통과했다. 단언을 8개 선택의 실제 필수 검사 목록으로 이전했다.
  실제 셋업→보호 전달 28항목은 유지했고 셋업→repo-sync Vue/Next.js 4개 조합도 통과했다.
- 전체 quality: 커밋 d02cf38의 72개 단계를 통과했다. Ubuntu 설치 단계는 macOS의 기존 rg와
  작업 전용 venv의 ruff 0.15.15로 대체하고 동일 lint·format 명령을 실행했다.
  첫 재시도는 임시 도구의 외부 Python symlink를 repo-sync가 거부했다. 제품 검사는 유지하고
  실제 가상환경을 기존 제외 경로 `venv`로 옮긴 뒤 27번째 단계부터 통과했다. 앞선 26단계의
  성공 결과와 동일 커밋·명령을 대조해 재사용했고 최초 실패 로그도 보존했다.
- 고정 후보 독립 검토와 현재 CI 결과는
  [해당 브랜치 PR](https://github.com/grinvi04/team-harness/pulls?q=is%3Apr+head%3Afix%2Fstructure-maintenance)에 기록한다.
  위 기록은 추가 지시 전 후보0bb8f84의 구현 검증이다. 그때 병합·발행·설치는 미실행이었다.

## 추가 승인과 전달 상태

사용자가 PR528 최종 확인·병합과0.88.0 발행·설치를 승인했다. 소개 HTML과 고정 풀스택을 제거하고,
과거 실행 원문은 Git으로 읽도록 바꾼다. 현재 정책·결정·CHANGELOG·시험 fixture는 유지한다.

- 개별6개·조합12개와 작업 경로 전달: 셋업36항목·스택11묶음 통과.
  잘못된 역할·경로 탈출·같은 경로·기존 파일 보존과 필수 검사를 확인했다.
- 소개 HTML의 현재 reader는 아키텍처 안내로, 실제17스킬 목록 검사는 플러그인 Markdown 안내로 이전했다.
- 역사773파일은 사용자 변경이 없는 Git 추적 파일만 삭제했다. 원문 고정 커밋과 복구 명령을 연결했다.
- 최종 후보85ad820: GitHub quality72단계·필수 CI5개와 별도 Astra/medium 읽기 전용 검토 PASS_SCOPED.
  실제 실행 metadata readOnly/networkAccess:false를 확인했다. 셋업39·Alembic16·스킬51·문서296파일도 통과했다.
- PR528은 develop에 병합했다(d430d00). 병합 tree는 검토·CI 후보와 동일하다.
  원격 작업 branch는 삭제됐고 사용 중인 로컬 branch는 보존했다. main 태그·발행·설치는 아래 체크포인트를 따른다.
- 독립 검토 d1c90f5: Python 조합의 Alembic 루트 self-skip과 Spring·프론트 보조 파일 누락2건으로 NO-GO.
  전체 검사는29단계 통과 시 중단했다. 당시 성공을 수정 후보의 전체 성공으로 옮기지 않는다.
  실제 셋업 보조 파일 시험24 PASS/12 FAIL과 조합 Alembic의 다중 head 오통과를 재현했다.
  선택한 작업 경로로 보조 파일과 Alembic 실행을 연결하고 기존 사용자 파일은 유지하도록 수정했다.
- 재검토 f517a8d: 단독 Spring이 상속된 BACKEND_DIR로 쓰기 경로를 바꿀 수 있는 반례1건을 발견했다.
  환경 변수의 상대·탈출·절대 경로3사례가 실패했다(36 PASS/3 FAIL). 단독은 기존 backend를 고정하고
  조합만 검증된 선택 경로를 사용하도록 수정했다. 각 실패 후보를 완료로 취급하지 않는다.

## 문서 동기화 범위

현재 안내는 `README.md`, `AGENTS.md`, `docs/harness-maintenance.md`,
`docs/repository-structure.md`, 스택·온보딩 관련 직접 안내와 이 스펙을 대조한다.
실험/역사 이동의 실제 직접 reader와 안내를 함께 갱신한다.
버전 준비는 두 plugin manifest·README 배지·CHANGELOG를 맞추며 발행 상태와 구분한다.
프로젝트 지도는 기본 작업 폴더 `.project-map/`의 기존 스타일·기록을 보존해 갱신한다.

## 0.88.0 릴리즈 준비 체크포인트

이 절은 main PR 생성 전 확인한 상태다. 이후 단계의 실제 결과는 release PR과 역병합 PR을 따른다.
- 소스 버전: 두 manifest·README0.88.0, CHANGELOG 재현 확인. 공개 설치 단위는 기존 harness-guard 하나다.
- 사전 검증: 코드 후보85ad820의 필수5CI·전체 quality·독립 보안 검토 통과. develop 병합 tree 동일.
- 외부 provenance: 실제 GitHub 원문7개 확인. 사전 bundle82개 checksum 확인; 발행 묶음은 태그 SHA에서 다시 만든다.
- DB·서버: Harness 자체 runtime DB·마이그레이션·배포 서버가 없어 실제 적용/health는 SKIP.
  SQL·Alembic·ActiveRecord·Flyway 템플릿과 거부/경계 시험은 quality에 포함했다.
- main PR·태그·GitHub 발행·Codex/Claude 공식 설치·develop 역병합은 이 체크포인트에서 미실행이다.
- 사용자 branch·다른 worktree를 보존하고 Claude 인증·실제 모델 검증 및 소비 원격·배포·결제는 제외한다.
