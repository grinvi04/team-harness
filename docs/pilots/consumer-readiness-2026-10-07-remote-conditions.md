# 소비 원격 전달 조건의 읽기 전용 확인

[상위 문서](consumer-readiness-2026-10-07.md)로 돌아간다. 아래는 원문의 해당 주제·당시 후보 기록을 순서대로 보존한 본문이다.

#### 전달 조건의 추가 확인 (2026-10-07)

공식 [Actions policy GET API](https://docs.github.com/en/rest/actions/policies#list-repository-actions-policies)에 API 버전 `2026-03-10`, `has_parents=true`를 지정했다. 네 repo 모두 HTTP 성공·`total_count:0`, workflow 기본 권한 `read`·자기 PR 승인 `false`다. 이는 명시 정책 목록의 관찰이며 플랫폼 기본 `pull_request_target` 정책 부재나 새 trusted workflow 실행 PASS를 뜻하지 않는다. 기본 브랜치 초기 배치·이후 동일 후보 target 실행과 서버 context 전환은 여전히 미실행이다.

Railway의 현재 인증으로 `DriverTree` 프로젝트의 정확한 service/repo 연결을 대조했다. staging은 현재 `source:null`, production은 `source.repo:grinvi04/drivertree`다. 양쪽 active deployment는 0, 최신 배포는 2026-06-08의 FAILED이며 당시 metadata만 staging develop/main production을 보여 준다. 따라서 문서상의 develop→staging 자동 배포를 현재 활성 연결로 확정하지 않는다. **현재 trigger branch·autodeploy·Wait for CI·PR environment·watch 설정은 이 CLI 조회에서 미확인**이다. deployment source 연결을 바꾸거나 실패 서비스를 복구하지 않았다. 변수·서비스 로그·DB는 조회하지 않았다.

Vercel CLI의 현재 인증은 invalid token으로 실패했다. 사용자는 이 단계의 Vercel 확인을 나중으로 미루도록 선택했다. 재인증·설정 조회·Vercel 전달은 후속이며 이번 단계에서 다시 시도하지 않는다. 다른 인증정보를 찾거나 자동 로그인·설치를 하지 않았다. 기존 GitHub Preview/Production 기록은 보존하되 현재 production branch·ignored build·PR Preview·환경 자격증명은 미확인이다. [Vercel Git 배포](https://vercel.com/docs/git)와 [Railway autodeploy](https://docs.railway.com/deployments/github-autodeploys)의 공식 설명처럼 별도 provider 연결은 Actions 결과만으로 통제됨을 보장하지 않는다. ERP의 Railway 프로젝트는 현재 목록에서 이름으로 매칭되지 않았으며 프로젝트 부재로 단정하지 않는다.

원문은 비밀정보가 없는 GitHub 정책·권한 응답과 Railway metadata 허용 필드만 기록했다. Railway 전체 응답/변수/로그는 저장하지 않았다. 현재 읽기 전용 결과와 명령·종료·지문은 다음에 보존한다.


이번 단계의 실행 순서와 종료 기준은 다음과 같다.

1. webhook 로그인 연결·state·승인된 admin 권한 보완: 실제 설치 SDK의 합성 HTTP·자체 서명 토큰·callback 대역 Redis에서 정상/오류/다른 브라우저/이전 쿠키 재생/만료/권한 거부를, 실제 격리 Redis에서 동시 원자 소비를 확인했다. `eba4bfb`의 전체 품질·독립 보안 검토·문서 인수를 마쳤다. 외부 운영 realm의 성공으로 확대하지 않는다.
2. DriveTree YAML 수정 후보 적용: Swagger 하위 pin만 제한하여 정상 문서 생성·조회와 예산 거부, 클린 lock 설치·전체 backend 품질/실DB·감사·독립 검토를 수행한다. `8c5b4f8`에서 이 로컬 보완·회귀·독립 검토를 마쳤다. 이전 `36f9b0d`의 115개 검증 기록과 라이브러리 표본의 한계를 보존하며 전체 감사·원격 인수 완료로 확대하지 않는다.
3. 공식 수정판 없는 braces/sprintf-js와 큰 의미 변경의 Prisma/Keycloak: DriveTree의 최소 Prisma 내부 보완은 `0a654e0`의 로컬 QA·감사·독립 검토로 인수했다. webhook 2.x 호환 pin은 새 감사 경고, 3.9.1은 만료 수용 P1 때문에 비교 후보로만 보존하고 채택하지 않는다. 최신 SDK 전환과 DriveTree braces 소비자 보완은 아래 최신 기록에서 구분한다. 남은 ERP braces/sprintf 경고는 현재 도달성·설치 정책과 공식 수정판 유무로 미해결 상태를 유지한다. 검증 전 강제 override·downgrade·감사 예외로 완료 처리하지 않는다. 잔여 경고의 수용 여부와 해제 조건을 제품 기록으로 결정한다.
4. 원격 전달: Preview·이미지 게시·외부 자동 배포 영향과 Actions event policy를 확인한 구체적 후보로 PR/CI 인수한다. trusted bootstrap과 필수 context 전환은 기존 보호 유지·정확 후보 실행·서버 readback을 각각 증명하며 이후 운영 배포는 별도 경계다.
