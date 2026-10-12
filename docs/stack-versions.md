# 기존 프로젝트의 스택·버전 확인

이 안내는 기존 앱에 Harness 검사와 설정을 연결하는 범위다. 앱 생성·의존성 업그레이드·lock 변경은 하지 않는다.
스택 선택 이유와 조합은 [선택 가이드](stack-guide.md), 원문 위치는 [구조 안내](repository-structure.md)를 따른다.

## 준비와 검사 범위

Harness checkout, Node22+, Bash, Python3.11+, Ruby와 RubyGems가 필요하다.
검사 도구는 Harness 안에만 준비한다. 소비 앱의 package manager·코드는 실행하지 않는다.

```bash
# Harness checkout에서 실행: 전역·소비 앱 설치가 아님
npm ci --ignore-scripts --prefix scripts/stack-versions
python3.11 -m venv .runtime/stack-versions/venv
.runtime/stack-versions/venv/bin/python -m pip install --require-hashes -r scripts/stack-versions/requirements.txt
export STACK_VERSION_PYTHON="$PWD/.runtime/stack-versions/venv/bin/python"
```

npm semver·PyPA packaging·RubyGems의 범위 규칙을 각각 사용한다. 도구 누락·조회 실패는 미확인이다.
Node의 npm lock v2/v3, Python PEP621·정확한 requirements pin, Rails의 정적 Gemfile/lock,
Spring Boot의 리터럴 Gradle plugin·wrapper·Java toolchain을 판독한다.
현재 pnpm/Yarn/Poetry/uv/Maven·동적 Gemfile/Gradle은 자동 지원하지 않는다. 앱 파일을 변환하지 않는다.
Java는 선택한 Adoptium LTS·Linux x64 Temurin JDK의 정확한 release pin을 확인하는 범위다.
다른 JDK 공급자를 조용히 대체하지 않는다. 조회/조건 추출이 실패하면 현재 범위에서 적용하지 않는다.
HTMX는 htmx.org npm의 정확한 pin을 지원한다. CDN-only 구성은 미확인이고 django-htmx를 강제하지 않는다.
Python marker는 선언한 정확한 Python 버전으로 먼저 활성 여부를 판단한다. 플랫폼·extra 조건은 미확인이다.
Nuxt는 exported defineNuxtConfig의 리터럴 module 목록만 판독한다. 축약형·계산·상속 설정은 별도 검토한다.
Hotwire는 활성 리터럴 pin과 gem의 turbo/stimulus(.min).js를 확인한다. 주석·조건부 Ruby·임의 파일은 근거가 아니다.
이 importmap 방식에는 Node를 추가하지 않는다. 외부 JS는 자체 버전 증거가 필요하다. npm은 실제 lock 항목이 필요하다.

## 선택과 읽기 전용 미리보기

번호1–8은 Node·Spring Boot·Python·Rails·Next.js·Vue·React+Vite·Nuxt다.
Python은 framework, Rails는 ui를 고른다. 서버 화면과 Inertia는 같은 앱이고 별도 frontend로 조합하지 않는다.
API 방식은 개별 frontend와 조합한다. 기존 범용 Python/Rails 번호 입력은 호환용이며 새 기본 추천이 아니다.

```bash
node scripts/check-stack-versions.mjs --project /path/to/react-app --stack 7
node scripts/check-stack-versions.mjs --project /path/to/django-app --stack 3 --framework django --ui templates
node scripts/check-stack-versions.mjs --project /path/to/rails-app --stack 4 --ui inertia-react
node scripts/check-stack-versions.mjs --project /path/to/project --stack 3+8 \
  --framework fastapi --ui api --backend-dir apps/api --frontend-dir apps/web
```

명시한 exact/latest → 기존 확정 버전 → 기존 선언이 없는 경우의 호환 최신 안정 제안 순서다.
Node의 최신 기본 제안은 지원 중인 LTS다. 지원 중인 비LTS는 exact로 지정할 수 있다.
미해결 range·lock·동적 선언은 최신 제안으로 덮지 않는다. 기존 버전과 요청 값이 다르면 충돌이다.
컴포넌트 키는 미리보기의 observed에서 확인한다. 조합은 backend/frontend, 단독은 project 역할이다.

```bash
node scripts/check-stack-versions.mjs --project /path/to/react-app --stack 7 \
  --version project.node=latest --version project.react=19.2.0
```

확정 버전의 공식 runtime·사용 중인 peer/UI·선택 module 조건을 대조한다. 전체 의존성 solver는 아니다.
React+Vite의 대체 SWC plugin 등 미지원 선언도 통과로 추정하지 않는다.
JSON의 compatible은 이 범위의 조건 확인이다. 앱 빌드·API/CORS·인증·배포 호환까지 보장하지 않는다.
exit0은 compatible, exit1은 conflict/unverified, exit2는 잘못된 입력이다.

## 기록과 CI

같은 명령에 --apply를 붙이면 compatible일 때만 harness-stack.versions.json을 새로 만든다.
선택·실제/대상 버전·조건·공식 출처/시각·허용 입력 SHA-256과 부재 지문을 저장한다.
기존 파일·링크를 덮지 않는다. 게시 직전 입력 지문을 다시 확인하고 같은 기록의 동시 생성을 거부한다.
이는 파일시스템 전체의 트랜잭션이 아니다. 악의적인 디렉터리 교체 등 검사·사용 사이의 모든 경쟁을 보장하지 않는다.
미리보기 JSON에서 issues의 다음 조치를 해결한 뒤 다시 확인한다. 실패를 PASS로 수정하지 않는다.
기록은 서명·전체 의존성 목록·비밀 파일 보관소가 아니다.

```bash
node scripts/check-stack-versions.mjs --project /path/to/react-app --stack 7 --apply
# 대상 앱에 배치된 checker: 현재 입력과 기록의 기계적 일치만 검사
node /path/to/react-app/scripts/check-stack-record.mjs --project /path/to/react-app
```

new-repo.sh는 준비된 GitHub 프로젝트 루트에서 실행한다. profile/UI/버전을 입력받아 같은 gate를 거친다.
버전 미확인·충돌·위험한 목적 경로·보존할 CI 충돌이면 기록/파일/훅 설정/원격 보호 변경 전에 멈춘다.
새 기록을 배치하거나 유효한 동일 기록을 재사용한 뒤, 정확한 runtime pin과 설치 전 fingerprint 검사 CI를 만든다.
CI는 최신 metadata를 다시 조회하지 않는다. 앱의 기존 lock 기반 설치·검사를 수행한다.
React/Nuxt와 Rails Inertia의 lint·typecheck·test:unit·build는 앱이 정의해야 한다.
Python 전문 프로필의 Ruff/mypy(Flask/FastAPI는 pytest도), Rails UI의 RuboCop 선언을 확인한다.
Python CI는 requirements.txt·pyproject.toml·requirements-dev.txt 중 존재하는 정적 입력을 모두 설치한다.
Python 프로필도 alembic-heads를 필수로 연결한다. DB를 선택·설치하지 않으며 alembic.ini가 없으면 해당 job만 self-skip한다.
Alembic job도 정확한 Python pin·기록 검사를 소비하며, 기존 사용자 job이 다르면 첫 쓰기 전에 보존·중단한다.
이 선언 확인은 도구 실행·설치 성공의 증거가 아니다. 실제 CI 검사로 확인한다. 빈 명령으로 대체하지 않는다.

기존 CI는 자동 적용 시 생성 결과와 정확히 같아야 재사용한다. 사용자 CI가 다르면 보존하고 적용을 중단한다.
수동 전환에서는 기록·runtime pin·설치 전 checker·필수 검사/권한을 검토하고 실제 CI를 확인한다.
기존 scripts/check-stack-record.mjs도 정본과 다르면 보존·중단한다. 검토 없이 교체하지 않는다.
기존 기록을 갱신할 때는 원문과 이유를 보존한 뒤 별도 변경으로 처리한다. 자동 덮어쓰기 기능은 없다.

## 기존 자산 점검과 버전 점검의 구분

```bash
node scripts/check-repo-sync.mjs --repo /path/to/app --json
node scripts/check-repo-sync.mjs --repo /path/to/app --versions
```

assetStatus·versionStatus·profiles·rules·catalogStatus를 따로 출력한다.
기록 없는 기존 repo는 자산 검사의 exit 관례를 유지하지만 versionStatus는 unverified다.
--versions는 기록 부재도 exit1이며, 기록이 있는 repo의 누락/변경/오류는 항상 실패한다.
설치된 plugin은 동봉 inspector/checker와 선택 기록을 읽는다. 카탈로그 부재를 저장소 경로로 우회하지 않는다.
Hotwire의 exact CDN pin은 브라우저 의존성이다. npm 프로젝트가 없으면 Node/npm을 요구하지 않는다.
Nuxt getter·환경별 module 설정과 Gemfile의 동적 Ruby 조건은 미확인이며 literal Ruby 조건은 runtime과 대조한다.
Python parser 부재도 미확인이다. 자산 존재·기록 일치와 실제 앱 검사·원격 보호·설치는 각각 따로 보고한다.
