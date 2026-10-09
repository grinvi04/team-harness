# 현대화 실행 기록

- 2026-10-09: 실행 승인·분리 브랜치·역사 증거 이관. 전역 설정과 소비 원본은 아직 적용 전.
- 권한 제약: native 협업 역할의 read-only 선언과 실행 workspace-write 차이를 보존했다. 지원 실행 경로에서 실제 차단을 확인한다.
- 현재 안내·진행 갱신 대상: 이 스펙/단계 문서, 관련 표준·caller·consumer 문서, `.project-map/`.
- raw 실행 기록은 이 스펙 소유 실행 공간에 저장하고 완료 때 필요한 증거만 후보와 함께 보존한다.

- 2026-10-09: 1A/1B/1C/1E의 영향 시험 및 2E 생성기 시험 통과. 1D·2A·2B·2C 영향 시험 통과; 2D 진행 중. 전체 인수·실제 적용·발행은 남아 있다.
- 2026-10-09: 2C의 설정 적용/실패와 단언 감소 시험 통과. count-only gate와 실행 QA의 역할을 구분해 완료 기준을 명확히 했다.

- 2026-10-09: Claude 터미널을 공식 update로 2.1.295로 갱신했다. 최신 모델 호출·effort·실제 앱 실행 확인은 별도 진행 중.

- 2026-10-09: 2D uncertain/coverage 판정, 3E 자동 cache patch 축소, 4B/C 의미 단위 분리와 generator/reader 후보 검증을 진행했다. 전체 gate는 별도 확인한다.
- 2026-10-09: Claude 첫 최신 모델 호출은 OAuth 만료로 실패했다. 사용자의 ‘나중에 갱신’에 따라 실제 Claude 모델·상속·권한·품질/사용량 비교는 보류한다. 강제 hook 제거와 native 정의의 정적/fixture 결과를 실제 호출 PASS로 바꾸지 않는다.
- 2026-10-09: 전역 15개 파일 실제 적용 완료. 공통 원본·두 진입점은 동일 본문 154줄이다. 적용 도구의 실패·복구·동시 변경 fixture 24건과 별도 읽기 전용 검토를 통과했다. 새 Codex 역할 호출과 공식 plugin 설치는 별도 검증 중이다.
- 2026-10-09: 권한 규칙 26개는 실제 native 정책 평가에서 prompt였다. 명령을 실행한 결과가 아니다. GitHub MCP wrapper의 버전 고정도 유지 지원·실제 MCP 성공을 증명하지 않는다. [전역 적용 기록](execution-m3f.json).

- 2026-10-09: Codex 여섯 역할의 모델/medium을 실제 확인했다. 쓰기 부모 아래 read-only 역할의 workspace-write 반례를 보존하고 별도 read-only 부모의 다섯 자식 policy를 확인했다. 새 역할 실행이 추가한 임시 trust 한 개만 제거했다.
- 2026-10-09: 공용 skill effort override 12개를 제거하고 본문/QA를 유지했다. 실제 workflow 비교에서는 두 후보 모두 잠긴 11개 회귀를 통과했으며 시간/사용량과 ephemeral metadata 한계를 별도 기록했다.
- 2026-10-09: 네 소비 프로젝트 문서 원본 적용·필수 로컬 검사·각 local commit을 완료했다. 새 원격 push/PR와 배포는 하지 않았다. [소비 적용 증거](execution-consumer-apply.json).
- 2026-10-09: `fc05d31` 독립 읽기 전용 검토에서 폼 파일 옵션·자동 CI fallback·누락 QA 상태 결함 3건을 확인했다. 각각 RED를 보존하고 수정·직접 회귀를 통과했다. 재검토에서 반복 type= 반례를 추가로 발견해 고쳤다. 후속279건 통과; 143ca921 독립 최종 소스 검토는 PASS다. [검토와 수정](execution-integrated-review.json).
- 앞의 모델 표본 두 후보도 새 누락 상태 경계에서 11 PASS/1 FAIL이었다. 당시 11개 기준의 시간·사용량을 현재 전체 품질 통과로 확대하지 않는다.
- 공식 CLI 격리 설치 3종을 `143ca921`에서 새로 확인했다. 16명령 exit0·설치된 66파일 일치·원본 152파일 불변이며 실제 dispatch·사용자 설치·발행은 별도 단계다.

- 2026-10-09: 깨끗한 Git archive의 공개 문서 검사에서 로컬 scratch 링크 6건이 실패했다. 공개 검증 기록으로 연결한 323ecd5 후보는 289 MD/0 FAIL, 관련 Node 34건 PASS다. checker와 기존 사용자 .gitignore는 그대로다.

- 2026-10-09 PR #506 required CI5개 PASS → develop1241295 병합. 독립 검토 대상143ca921과 runtime 바이트 동일, tested head5a449ea와 merged tree 동일 확인. release-check live provenance7건 및79파일 bundle/checksum PASS; main 새 승인·태그·설치·지도·정리는 전달 기록에서 계속한다.
- 실제 지도 서비스가 `project/project-map`으로 이동한 것을 재확인했다. 복구 사본은 보존하고 현재 호출부 후보의 기존211+새7시험 PASS를 확인했다. 별도 read-only 독립 검토·실제 적용은 아직 진행 중이다.
- 현재 지도 호출부 독립 검토도 PASS. 실제 Astra/medium/read-only/never 정책과 append 거부·불변을 관찰했다. parser/UI/registry를 유지한 메모리 내 연결 반증과 원본105해시를 확인했으며 실제8797활성화는 아직 미실행이다.
- main PR #507의 최초222103c CI는 공개 안전성19PASS1FAIL: 새 전달 JSON에 개인 홈 cwd가 남았다. 원시 증거는 보존하고 공개 투영만 `$HOME`으로 정규화했다. 검사·승인·품질 기준은 유지하며 같은 gate와 새 후보 CI를 다시 확인한다.
