# 현대화 실행 증거

실행 문서는 당시 후보·명령·종료 코드·최초 실패와 최종 결과를 구분한다.
PASS는 해당 실행 범위이며 현재 전체 gate·실제 설치·배포를 자동 증명하지 않는다.

- `.gz`는 원시 로그/fixture의 바이트를 보존하는 gzip 저장이다. [저장 목록](encoded-files.json)의 원시 digest와 대조할 수 있다.
- 공개 텍스트의 개인 홈 경로는 `$HOME`으로, 논리 agent ID의 root는 `agent:root`로 표기했다.
- [표기 변경 목록](path-normalization.json)은 변경 전/공개 사본 digest를 구분한다. 원본 사본은 작업의 비공개 보존 자료에 유지한다.
- 이 표기는 경로 자체의 공개 표현만 바꾼다. 실패·날짜·모델·후보·시험 판정은 바꾸지 않는다.
- 최초 기록의 `.superpowers/sdd/harness-modernization/` 참조는 당시 실행 공간이다. 인계 시 보존한 묶음에 연결한다.
- Claude 실제 추론은 사용자의 인증 갱신 보류에 따라 USER-DEFERRED다. 정적 설정·hook 호환 시험과 구분한다.
