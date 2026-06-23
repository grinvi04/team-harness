# 아키텍처·인프라 가이드

`stack-guide.md`의 후속 — 레포 전략, 서비스 아키텍처, GitOps, 인프라·네트워크 표준.
대상 시스템: SCM·ERP·업무 자동화 / 팀 규모 5–10인+ / AWS EC2 → EKS 확장 경로.

---

## 1. 레포 전략 — 멀티레포 (서비스 = repo)

**결정: 서비스 단위 멀티레포 + 별도 GitOps config repo.**

| repo | 내용 |
|---|---|
| `<service>` (서비스별) | 백엔드 서비스 코드 + `.claude/` + `.githooks/` + ci-gate |
| `<frontend>` | React/Next 프론트엔드 (별도 배포 주기) |
| `infra` | Terraform (VPC·RDS·EKS 등 — PR로 plan/apply) |
| `gitops-config` | K8s 매니페스트/Kustomize 오버레이 (EKS 단계에서 생성, Argo CD가 watch) |
| `team-harness` | 공통 거버넌스 플러그인 + 템플릿 (이 repo) |

근거와 조건:
- 멀티레포가 맞는 이유는 EKS 자체가 아니라 **미니서비스 + GitOps와의 결합** — 서비스별 독립
  배포·독립 CI 게이트·repo 권한 분리가 자연스럽다. (EKS는 모노레포로도 배포 가능)
- 멀티레포의 고전적 비용(공통 설정 fan-out)은 **team-harness 플러그인 마켓플레이스가 해결** —
  모든 repo가 `extraKnownMarketplaces` 선언 한 줄로 동일 거버넌스를 받는다.
- ⚠️ **서비스 경계가 검증되기 전에 레포부터 쪼개지 않는다.** 시작은 백엔드 1 repo
  (모듈러 모놀리스) + 프론트 1 repo + infra 1 repo. 분리는 §2의 경계 검증 후.

## 2. 서비스 아키텍처 — 모듈러 모놀리스 → 미니서비스

**결정: 풀 MSA 도입하지 않음. 미니서비스(도메인 묶음 단위의 적정 규모 서비스)를 목표 상태로,
모듈러 모놀리스에서 출발.**

- **풀 MSA를 배제하는 이유**: 5–10인 팀에서 수십 개 마이크로서비스는 분산 트랜잭션(사가),
  분산 추적, 서비스별 배포 파이프라인 운영 비용이 이득을 압도한다. ERP/SCM은 정합성이
  생명이라 분산 정합성 비용이 특히 크다.
- **미니서비스**: 모놀리식과 MSA의 중간 — 도메인 묶음 단위 3~7개 수준의 서비스
  (예: 기준정보 / 주문·영업 / 재고·물류 / 정산·회계). 서비스 수가 적어 운영 가능하고,
  팀·도메인 단위 독립 배포는 확보된다. 실무 검증된 접근.
- **전환 경로 (강제 순서)**:
  1. 클린아키텍처 + **도메인 모듈 경계**를 가진 모놀리스로 시작 (모듈 간 직접 참조 금지,
     인터페이스 경유 — 이 규율이 미래 분리 비용을 결정한다)
  2. 모듈 경계가 실사용으로 검증되면(변경 빈도·팀 분담·배포 주기가 갈리는 지점),
     그 경계만 미니서비스로 분리 + repo 분리
  3. 서비스 간 통신: 동기 REST 최소화, 필요해지는 시점에 이벤트(SQS/SNS → 필요 시 Kafka).
     **DB는 처음부터 서비스(모듈)별 스키마 분리** — 같은 PostgreSQL 인스턴스라도 스키마
     경계를 지키면 분리 시 데이터 이관이 단순해진다. 크로스 스키마 조인 금지.

## 3. GitOps

**원칙: 모든 상태(앱 버전·인프라·설정)는 git에 선언되고, 변경은 PR로만, 배포는 git 상태와
자동 수렴.** 수동 콘솔 변경 금지(드리프트는 Terraform plan이 검출).

단계 적용:

| 단계 | 방식 |
|---|---|
| EC2 단계 | **GitOps-lite**: GitHub Actions가 git 상태 기준으로 배포(push형). 배포 대상 버전·설정 전부 git에. 콘솔 수작업 금지 원칙은 동일 적용 |
| EKS 단계 | **풀 GitOps**: Argo CD(사실상 표준) + Kustomize(단순 시작, 필요 시 Helm). 앱 repo CI가 이미지 빌드·푸시 후 `gitops-config`의 이미지 태그를 PR/커밋 → Argo CD가 pull·수렴 |
| 인프라 | **Terraform** (`infra` repo): PR에서 plan 출력 확인 → 머지 시 apply (GitHub Actions OIDC) |

배포 흐름(EKS): 코드 PR 머지 → ci-gate → 이미지 빌드 → ECR push → gitops-config 태그 갱신
→ Argo CD 동기화. 롤백 = config repo revert (git이 곧 배포 이력).

## 4. 인프라·네트워크 표준

### 네트워크 (VPC)

- **3계층 서브넷 × 멀티 AZ(2+)**: public(ALB·NAT) / private(앱·EKS 노드) / isolated(RDS·ElastiCache)
- 진입 경로: Route53 → CloudFront(프론트 정적 자산) / ALB(API, ACM TLS 종단) → 앱
- **WAF**를 ALB/CloudFront에 (SQLi·XSS 룰셋 — ERP는 내부망 성격이라도 외부 노출 시 필수)
- 사내 전용 시스템이면: ALB를 internal로 + VPN(Client VPN) 또는 IP 허용목록
- 보안그룹은 최소 개방: 앱→DB 포트만, 퍼블릭은 ALB 443만

### 접근 통제

- **서버 SSH 금지 → SSM Session Manager** (키 관리 제거, 접속 감사 로그 무료 확보)
- **GitHub Actions → AWS는 OIDC 페더레이션** (장수 액세스 키 발급 금지)
- IAM 최소권한: 서비스별 역할 분리, 사람 계정은 SSO/MFA

### 인증 인프라 (Keycloak — `auth-standards.md` 확정 사항)

- 배포: 컨테이너 (EC2 단계 compose 워크로드 / EKS 단계 전용 Deployment), `infra` repo에서 Terraform 관리
- 저장소: 전용 DB (RDS 내 별도 database) — 앱 스키마와 분리
- **SEV1 컴포넌트** — IdP 중단 = 전 서비스 로그인 불가: 헬스체크·알람 필수, EKS 단계에서 2+ replica
- realm·클라이언트 설정도 export하여 git 관리 (GitOps 원칙 동일 적용 — 콘솔 수동 변경 금지)
- 버전 업그레이드는 staging 선검증 후 적용

### 데이터 계층

- RDS PostgreSQL: private 서브넷 + 멀티 AZ + 자동 백업/PITR + 삭제 보호
- ElastiCache Redis: 세션·캐시 (필요 시점에 추가)
- S3: 첨부파일·리포트 산출물 (수명주기 정책 + 버저닝), 암호화 기본(SSE)

### 관측성 (Observability)

- 로그: 구조화 JSON(stack-guide의 로깅 표준) → CloudWatch Logs (EKS 전환 시 동일 포맷으로
  수집기만 교체 — Fluent Bit)
- 메트릭/대시보드: EC2 단계 CloudWatch → EKS 단계 Prometheus + Grafana
- 에러 트래킹: Sentry / 알림: CloudWatch Alarm·Sentry → Slack
- 감사 로그: CloudTrail 전 리전 활성화 (ERP 컴플라이언스 대비)

### 백업·DR

- 데이터: RDS 자동 백업 + PITR, 스냅샷 교차 리전 복제(중요도에 따라)
- 시스템: **GitOps 자체가 DR 문서** — infra(Terraform) + gitops-config(매니페스트)로
  전체 환경 재구축 가능 상태를 유지하는 것이 목표. 분기 1회 복구 리허설 권장.

### 환경 분리

- `dev` / `staging` / `prod` 최소 3환경, 계정 분리(prod 별도 AWS 계정) 권장
- 환경별 차이는 gitops-config 오버레이(Kustomize) / Terraform workspace·tfvars로만 표현

## 5. Docker 이미지 기준 (AWS 특화)

**원칙: 베이스 이미지는 AWS 공식 배포 이미지를 사용한다.** ECR public에 미러가 있는 경우 `public.ecr.aws`에서 가져온다 — Docker Hub rate limit과 공급망 리스크를 동시에 줄인다.

| 런타임 | 빌드 이미지 | 런타임 이미지 | 비고 |
|---|---|---|---|
| Java | `amazoncorretto:21-al2023-jdk` | `amazoncorretto:21-al2023-jdk-headless` | headless = GUI 라이브러리 제외(더 작음). 로컬·CI·Docker 모두 Corretto 통일 |
| Node.js | `public.ecr.aws/docker/library/node:22-alpine` | `public.ecr.aws/docker/library/node:22-alpine` | Alpine 기반, ECR public 미러 사용 |
| Python | `public.ecr.aws/docker/library/python:3.12-slim` | `public.ecr.aws/docker/library/python:3.12-slim` | slim = 불필요 패키지 제외 |

**멀티스테이지 빌드 필수**: `build` → `runner` 2단계. 빌드 도구·소스가 런타임 이미지에 포함되지 않도록.

**GitHub Actions setup-java**: `distribution: corretto` (Docker 이미지와 동일한 배포판 — `temurin` 사용 금지).
