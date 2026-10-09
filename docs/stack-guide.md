# 기술 스택 선택 가이드

먼저 [표준 적용 기준](standards-scope.md)을 읽는다.
이 문서는 선택을 돕는다. 특정 언어·DB·인증 공급자·호스팅을 모든 프로젝트에 확정하지 않는다.

## 선택 순서

1. 제품의 기능, 데이터 정합성, 응답 시간과 운영 제약을 확인한다.
2. 팀의 경험과 유지보수할 사람, 사용할 라이브러리의 지원 상태를 확인한다.
3. 배포 환경·비용·보안 조건에 맞는 작은 구성으로 시작한다.
4. 선택과 이유를 해당 프로젝트에 기록한다. 기존 기술을 근거 없이 교체하지 않는다.

최신 버전은 시작 시 공식 릴리즈에서 확인한다. 런타임·프레임워크·드라이버의 호환 범위도 확인한다.
선호도나 국내 채용 우위를 출처 없이 기술적 보장으로 쓰지 않는다.

## 공식 사용법과 문제 해결 경로

| 기술 | 공식 자료 | 선택할 때 확인할 것 |
|---|---|---|
| Java/Kotlin·Spring | [Spring Boot](https://docs.spring.io/spring-boot/index.html) | JDK 지원, 프레임워크·ORM 호환, 빌드 도구 |
| TypeScript·NestJS | [NestJS](https://docs.nestjs.com/) | 런타임 입력 검증, 이벤트 루프, 작업 처리 방식 |
| Python·Django | [Django](https://docs.djangoproject.com/) | 관리 기능, ORM, 동기·비동기 경계 |
| Python·FastAPI | [FastAPI](https://fastapi.tiangolo.com/) | ASGI, 동기 호출, 작업·DB 세션 수명 |
| Ruby·Rails | [Rails Guides](https://guides.rubyonrails.org/) | 프레임워크 관례, DB 변경, 배포·작업 처리 |
| React·Next.js | [Next.js](https://nextjs.org/docs) | 서버·브라우저 경계, 캐시, 배포 런타임 |
| Vue·Nuxt | [Vue](https://vuejs.org/guide/introduction.html), [Nuxt](https://nuxt.com/docs) | 반응성, SSR 요청 격리, 빌드·타입 검사 |
| PostgreSQL | [공식 설명서](https://www.postgresql.org/docs/) | 데이터 타입, 트랜잭션, 연결·잠금, 백업 복원 |

프레임워크의 기본 구조를 먼저 활용한다. 공통 계층·상태관리·메시지 큐는 필요한 문제를 확인한 뒤 추가한다.
JPA·Prisma·SQLAlchemy·ActiveRecord는 각각의 장단점을 가진 후보다. ORM 이름을 공통 필수로 두지 않는다.
JDK 배포판과 컨테이너 레지스트리는 지원·라이선스·공급망 조건으로 선택한다.
로컬·CI·배포의 지원 버전을 맞추되 특정 공급자만 사용하도록 강제하지 않는다.

## 공통 계약과 선택 사항

- API 형식은 [API 표준](api-standards.md)의 선택 조건을 따른다.
- 데이터 식별자·감사·삭제 정책은 [DB 표준](db-standards.md)과 제품 요구로 정한다.
- 인증 공급자·권한 모델은 [인증 표준](auth-standards.md)에 맞춰 프로젝트에서 정한다.
- 코드 구조는 [클린 아키텍처](clean-architecture.md)의 비용과 대안을 확인한다.
- 호스팅·컨테이너·관측성은 [인프라 가이드](architecture-infra.md)에서 조건별로 선택한다.
- 테스트·lint·타입 검사는 프로젝트의 실제 명령과 CI에 연결한다. 문서 존재만으로 강제되지 않는다.

## 스택별 문제 해결

[백엔드](stack-troubleshooting-backend.md), [프론트엔드](stack-troubleshooting-frontend.md),
[DB·마이그레이션](stack-troubleshooting-database.md)에서 증상별 확인 경로를 찾는다.
스택 규칙은 `templates/rules/stacks/`에 있다. 필요한 파일만 복사하고 경로·명령을 실제 프로젝트에 맞춘다.
현재 예시는 소비 앱에서 모두 실행한 결과가 아니다. 프로젝트의 지원 버전으로 검증한 뒤 채택한다.
