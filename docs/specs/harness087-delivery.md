# Team Harness 0.87.0 전달

2026-10-11 사용자 승인: 누락 재확인, 병합·발행·설치, 기존 개별 grill-me 삭제.
0.87.0은 Harness 플러그인 버전이다. Codex CLI 버전과 구분한다.

## 발행·설치 결과

2026-10-11 [main PR #524](https://github.com/grinvi04/team-harness/pull/524) 병합을 확인했다.
실제 merge SHA는 0c686cb7abe17ea086cefbd7f57a579777bdfc6e다. 원격 v0.87.0 exact ref와
peeled commit이 같은 SHA다. 발행 범위는 Git 태그·기존 marketplace 원본이다.
공식 CLI로 Codex·Claude Harness0.87.0을 설치하고 두 도구의 활성 상태를 확인했다.
Codex CLI는0.161.0이다. CLI 버전과 플러그인 버전을 구분한다.

| 항목 | 확인한 실제 결과·범위 |
|---|---|
| 설치 원본 | 두 marketplace HEAD가 태그 SHA와 일치. Codex ref는 v0.87.0 |
| 설치 파일 | 두 cache 각각70개 경로·SHA-256이 발행 원본과 모두 동일 |
| Native 계약 | manifest·hook·skill17개 계약 PASS |
| 새 발견 | 새 app-server Harness17개 모두0.87.0 활성, errors0 |
| 가드 표본 | 파괴 삭제·비밀값·인증파일 전송 입력3개 exit2, 정상 명령 exit0; sentinel 보존 |
| Doctor | managed requirements·CLI·plugin·native·repo sync·보호 PASS, healthy |
| 보호 복원 | main solo 전후 main/develop 전체 JSON 의미 동일, 승인1/0·필수CI5개 유지 |
| 전역 보존 | Harness ref 외 Codex 설정, Claude 설정·전역 규칙·managed requirements 동일 |
| 기타 plugin | identity·source·enabled 보존; 다른 Codex plugin 표시 버전 변화0 |

가드 표본은 설치 script의 직접 분류이며 위험한 shell payload를 실행하지 않았다.
새 발견과 doctor는 기존 열린 대화의 재로딩이나0.87 host hook 실제 발화를 증명하지 않는다.
Claude 공식 CLI는 재시작 후 적용을 안내했다. Claude 인증 갱신·실제 모델 검증은 계속 보류다.
Doctor의 선택 model probe는 미실행이다. Matt 묶음 CHAT metadata 경고도 별개로 남아 있다.

## 역병합·보관의 판정 경로

이 실제 결과를 포함한 sync/backmerge-v0.87.0 → develop PR에 main 릴리즈 이력을 반영한다.
문서 추가가 있으므로 순수 동일 내용 역병합으로 취급하지 않고 현재 후보 전체 게이트를 적용한다.
현재 상태의 정본은 [역병합 PR](https://github.com/grinvi04/team-harness/pulls?q=is%3Apr+head%3Async%2Fbackmerge-v0.87.0)과 origin/develop이다.
PR이 MERGED이고 태그 커밋이 develop에 포함됐을 때 역병합 완료다.
소유 worktree는 clean·병합 포함을 확인한 뒤 앱의 archive_worktree로 보관한다.
앱 archived_worktree 영수증과 실제 경로·Git 등록의 부재가 모두 확인될 때 정리 완료다.
source 수정 worktree는 이미 이 조건을 확인했고 정상 branch-d로 정리했다.
사용자 primary/d1f9는 branch·HEAD·변경을 보존한다. 사용 중인 develop을 강제 전환하지 않는다.
최종 역병합·보관 판정은 프로젝트 .project-map/의 현재 증거와 전달 결과에 함께 기록한다.

## 완료 기준과 순서

1. 현재 후보의 누락·독립 보안 검토·live 외부 증거와 필수 CI를 확인한다.
2. 수정 PR → develop, release/v0.87.0 → main을 현재 head/base 게이트와 래퍼로 병합한다.
3. 실제 main 병합 SHA에 exact v0.87.0 태그를 발행하고 원격 peeled SHA를 대조한다.
4. 공식 CLI로 Codex·Claude Harness를 갱신하고 버전·활성·파일·새 스킬 발견을 대조한다.
5. main → develop PR에 실제 결과를 기록하고 역병합·소유 작업공간 보관을 확인한다.

발행은 기존 Git 태그·marketplace 원본을 뜻한다. 별도 GitHub Release·분리 package 공개는 포함하지 않는다.
사용자 primary와 d1f9의 branch·HEAD·변경을 보존하고 앱 삭제 제한을 우회하지 않는다.
Claude 인증 갱신·실제 모델 검증과 소비 원격 작업·배포·결제는 제외한다.
실제 DB·서버·스테이징·프로덕션이 없는 저장소이므로 DB·배포 health만 SKIP이다.
미실행 필수 검사·조회 실패를 SKIP으로 바꾸지 않는다.

## 릴리즈 준비 결과

PR [#523](https://github.com/grinvi04/team-harness/pull/523) 병합 커밋은 d06c78032eda86bc21fab7c51a4e03a17b9a10a9다.
현재 원격 develop과 동일하고, 수정후 PR 후보7843657과 tracked tree가 같다.
필수 CI5개 SUCCESS, quality의69개 실행 단계와 setup/cleanup 포함73개 단계가 모두 통과했다.
별도 Astra/medium/read-only 검토가 raw diff31파일과 직접 소비자를 읽었고 구체적 차단 결함을 찾지 못했다.
정정 문서도 별도 독립 검토했다. guard·hook·정책 실행 코드는 기존 버전과 같다.
현재 develop에서 live 외부 자료7개, changelog72파일, package4종68파일, bundle checksum을 확인했다.
필수 보안 검토 PASS_SCOPED, 실제 DB·배포 환경·health 비적용으로 **release-check GO_SCOPED**다.
DB 공용 표준 문서는 소비자 계약이며 이 저장소에 운영 DB가 있다는 뜻이 아니다.
이 기록은 릴리즈 준비 시점의 스냅샷이다. main 병합·태그·설치는 아직 미완료다.
발행 뒤 실제 결과는 [develop의 최신 기록](https://github.com/grinvi04/team-harness/blob/develop/docs/specs/harness087-delivery.md)으로 연결한다.

## 준비 후보와 기존 증거

구현0a0fb9d의 코드와 quality 검증cafdadff의 코드가 같다. 이후 변경은 현재 진행 기록이다.
검사 원본은 [스킬 통합 기록](skill-contract-consolidation.md)의 검증 결과를 따른다.
로컬 macOS CI quality69단계 통과는 같은 코드 범위의 증거이며 현재 GitHub CI와 구분한다.
이번 PR의 필수 CI·독립 검토·live 외부 provenance는 현재 후보로 새로 확인한다.
release-check의 필수 독립 보안 검토는 일반 AI 검토로 대체하거나 조건부로 생략하지 않는다.
package/bundle은 현재 committed 후보로 다시 생성·검사하며 installable:false를 유지한다.

## grill-me 정리 결과

개별 폴더 ~/.agents/skills/grill-me의 파일2개와 디렉터리를 실제 삭제했다.
해당 경로의 불필요한 skills.config 한 항목도 제거했다. 다른 설정은 보존했다.
공식 managed mattpocock-skills1.2.3 설치를 유지한다. 새 app-server 발견은35개 중
명시 활성 grill-me/grilling2개, 나머지33개 비활성, 개별 설치 발견0, errors0이다.
현재 열린 대화의 제공 목록에는 이전 개별 항목과 비활성 항목이 남아 있다. 새 native 조회 결과와
현재 대화의 목록은 구분하며 모든 채팅의 즉시 갱신을 보장하지 않는다.
CHAT 제품 metadata 경고·인터뷰 실제 실행·열린 채팅 재로딩은 미확인 범위를 유지한다.
cache를 임의 수정하지 않는다. 향후 버전 변경 뒤 skill 활성 범위를 다시 확인해야 한다.

## 역병합 준비 시점의 체크리스트

- [x] 기존 개별 설치 실제 삭제와 fresh native 발견 확인.
- [x] 독립 누락·보안 검토, 현재 PR CI와 develop 병합.
- [x] 정식 release-check GO, main 병합·원격 태그 SHA 확인.
- [x] Codex·Claude 설치와 원본 파일·활성·발견 검증.
- [ ] 실제 결과 기록·develop 역병합·소유 worktree 보관.

각 단계의 후보·명령·결과는 현재 작업 증거 work/harness087-delivery/에 저장한다.
최종 단계는 실제 PR 상태·원격 Git·설치 cache·앱 영수증과 경로/등록 부재로 판정한다.

최초 PR523 후보1d07266의 CI는 새 문서의 개인 홈 절대 경로를 차단했다.
공개 문서 경로를 일반 사용자 표기로 고쳤으며 검사 기준은 그대로 유지했다. 수정 후보7843657의 필수 CI5개가 모두 통과했고 source PR을 병합했다.
