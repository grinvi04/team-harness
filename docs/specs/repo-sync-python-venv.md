# Python venv 탐색 경계와 소비 repo 자산 점검

## 범위·판정

2026-10-06, 기준 develop `79fd3e2c98a950b9052d7e22e8c962748af5f80c`.
판정은 **소유**: 표준 자산 검사기의 소스/생성 의존 데이터 구분은 Harness의 책임이다.
Python 환경 생성·interpreter 수명주기는 도구에 위임한다. 소비 repo 수정·배포는 계속 보류한다.
정적 드리프트 점검을 제품 QA 실행이나 branch protection 강제의 증거로 확대하지 않는다.

## 요구·필수 QA 범위

| 요구·위험 | 조건·행동 | 독립 기대 결과 | 관찰 방법 |
|---|---|---|---|
| 생성 환경으로 검사 중단·스택 오탐 | 실제 venv 디렉터리, 일반 pyvenv.cfg, 외부 interpreter 링크와 Next.js 의존 신호 | exit 0, 원래 java/flyway만 감지 | 실제 checker + 격리 fixture |
| 이름만으로 실제 소스 누락 | cfg 없는 venv에 Next.js package.json | typescript/nextjs 감지 유지 | 같은 checker 출력 |
| 제외 조건으로 외부 탐색 우회 | venv directory symlink 또는 외부 cfg symlink | exit 1 유지 | 거부 fixture |
| 기존 경계 회귀 | 깊은 Flyway, 내부 일반 파일 링크, 외부·dangling·FIFO 링크 등 기존 사례 | 기존 허용·거부 결과 유지 | repo-sync 전체 시나리오 |
| 직접 소비자에서 원래 중단 해소 | 네 repo 읽기 전용 재실행 | 네 자산 보고서 생성; webhook은 python/alembic 감지 | 실제 repo별 stdout·exit code |
| 공통 배포 자산 정합성 | 버전·문서·구문·전체 품질 검사 | 정본 CI quality와 독립 검토 통과 | 현재 후보 검사·PR CI |

위 항목은 모두 필수다. 제품 UI/DB/성능 시험은 검사기 변경에 비적용이며 소비 제품의 품질을 판정하지 않는다.
기존 `.venv` 고정 제외는 유지한다. `venv` 조건은 환경 내용이 안전하다는 인증이 아니며,
일반 cfg marker를 가진 생성 디렉터리 안을 소스 범위로 삼지 않는 명시적 분류다.

## 재현·수정 결과

최초 webhook 점검은 `venv/bin/python`의 외부 target 때문에 exit 1, 요약 생성 전에 중단했다.
이 최초 결과는 자산 드리프트 판정이 아니라 **UNVERIFIED**다.
`bash tests/repo-sync-test.sh` RED는 PASS 39 / FAIL 1이며 생성 venv 사례만 실패했다.
외부 interpreter fixture를 둔 실제 checker가 실패하므로 단순 소스 텍스트 비교가 아니다.
최소 수정 뒤 같은 명령은 PASS 40 / FAIL 0, `node --check`도 exit 0이었다.
실행 환경은 macOS, Node v22.18.0이다. 로그는 작업 호스트의 임시 경로에 있으며 이 문서는 실행 요약이다.

네 소비자 재실행의 원문 출력·명령·작업 디렉터리·checker digest·소비 HEAD/status는
[정규화 결과](../pilots/consumer-repo-sync-2026-10-06.json)에 보존한다. 개인 경로는 `<USER_HOME>`이다.
checker digest는 해당 실행 당시 미커밋 수정 파일에 대응한다. 이후 동일 digest를 후보와 대조한다.

| repo | OK | WARN | MISSING | 실행 / 의미 |
|---|---:|---:|---:|---|
| erp | 16 | 1 | 4 | exit 1, 커밋 강제 체인 드리프트·Next.js rule 경고 |
| siku | 5 | 0 | 11 | exit 1, pointer·커밋 체인·공통 DDL bundle 드리프트 |
| webhook-service | 7 | 0 | 11 | exit 1, 탐색 중단 해소·pointer/커밋/DDL 드리프트 |
| DriveTree | 15 | 0 | 3 | exit 1, 커밋 workflow/config/validator 드리프트 |

MISSING은 checker의 필수 표준 미충족 분류다. 특히 커밋 체인은 정본 digest 불일치도 포함하므로
파일 자체의 부재와 동일하지 않다. 다른 언어의 DDL 검사도 현행 공통 bundle 계약에 따라 포함된다.
네 repo의 drift-free 기준은 **FAIL**이며 검사기 수정의 수용 기준인 보고 생성은 **PASS**다.
기존 역사적 zero-drift 기록을 덮어쓰지 않는다. 그 당시 후보와 지금 자산은 다르다.

## 진행·다음 행동

소스 후보는 저장소 동작 변경 정책에 따라 0.81.0이다. 릴리즈·설치 완료를 뜻하지 않는다.
전체 품질 및 독립 검토 결과와 develop 전달 상태는 이 작업 PR 원본에 연결한다.
소비 repo 후속은 별도 승인을 받은 뒤 정본 자산 변경 PR과 해당 제품의 QA 계약을 검토한다.
이번 점검에는 서버 보호 정책 조회·제품 시험·소비 파일 수정·배포가 포함되지 않는다.

## 문서 동기화

```harness-doc-sync
{"version":1,"documents":[
 {"path":"docs/specs/repo-sync-python-venv.md","reason":"필수 범위·재현·결과·미해결 소비 drift"},
 {"path":"docs/pilots/consumer-repo-sync-2026-10-06.json","reason":"읽기 전용 원문과 후보 digest"},
 {"path":"docs/harness-maintenance.md","reason":"생성 venv 제외 조건과 기존 거부 경계"},
 {"path":"docs/product-direction.md","reason":"QA 후속 점검과 소비 수정 보류 상태"},
 {"path":"README.md","reason":"소스 후보 버전"},
 {"path":"docs/intro.html","reason":"소스 후보 버전"},
 {"path":"CHANGELOG.md","reason":"생성 변경 이력"}
],"items":[]}
```
