# Codex native loader pilot

- 판정: **PASS**
- 시각: 2026-07-23T16:53:33.180Z
- Codex: codex-cli 0.144.6
- 실행 증거: live
- Codex binary: codex @ $HOME/.codex/packages/standalone/releases/0.144.6-aarch64-apple-darwin/bin/codex (sha256:80a3933d11a9d13ef806aa24f7bb8afc9169cfe4e9b09d6da6a92922cbde9cff)
- Team Harness: 0.61.0 @ a1b411afe3123e00ecba1e53d05318d68aa5a66a
- Git tree: 69310965b7676904a22cf9401e70cec81fa8e571

## 검증됨

- 공식 local marketplace 설치: PASS
- source-native skill 16개 발견: PASS
- 파괴 명령 차단·sentinel 보존: PASS
- 시크릿 외부 전송 차단: PASS
- UserPromptSubmit 라우팅: feature-add
- guard transcript: codex-native-loader-v0.61.0.guard.txt (sha256:bc1bf1d45a2af553c959bfeb3d2f295ad7d48c5b579cbf2c777a957cb7b73284)
- routing transcript: codex-native-loader-v0.61.0.routing.jsonl (sha256:a3ba5f07934fdc6a632da69f09c46073177637816c2cfda563eff1f1de615ce5)
- 사용자 marketplace/plugin 상태 byte-equivalent: PASS
- 격리 CODEX_HOME 삭제: PASS

## 판정·한계

- split package 승격: **아니오** — 이번 파일럿은 monolith native loader만 검증했다.
- 추론: loader·hook lifecycle은 Codex 공식 plugin surface가 소유하고 Team Harness는 결과 계약만 연결한다.
- 한계: 단일 Codex 버전·현재 계정의 로컬 표본이며, 외부 security-guidance cache patch 제거는 범위 밖이다.
- 네트워크 한계: 모델 연결 불가 시 `session-network-unavailable`로 fail-closed하며 해당 시도는 live 증거로 승격하지 않는다.
