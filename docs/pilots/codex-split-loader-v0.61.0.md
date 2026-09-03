# Codex split package loader·rollback pilot

- 판정: **PASS**
- 시각: 2026-09-03T02:36:20.240Z
- 증거: live
- Codex: codex-cli 0.144.6
- Codex binary digest: sha256:80a3933d11a9d13ef806aa24f7bb8afc9169cfe4e9b09d6da6a92922cbde9cff
- Team Harness revision: d580808f48751adb598fc38dd307e51183a64583
- Git tree: b764d55831c763ef062616c9289b2369056ba268
- split package version: 0.61.0

## profile 검증

- repository-only: 설치 PASS, cache exact PASS, rollback PASS (harness-governance-core)
- agent-governed: 설치 PASS, cache exact PASS, rollback PASS (harness-governance-core → harness-codex-adapter)
- workflow-assisted: 설치 PASS, cache exact PASS, rollback PASS (harness-governance-core → harness-codex-adapter → harness-workflows)

## 상태 보존

- 사용자 Codex 상태 불변: PASS
- source 상태 불변: PASS
- 격리 HOME 삭제: PASS

## 판정·한계

- split package 승격: **아니오**
- 검증됨: Codex 공식 local marketplace loader의 독립 설치·역순 제거와 exact cache digest.
- 추론: loader lifecycle은 Codex가 소유하고 Team Harness는 결과 계약을 연결한다.
- 한계: Codex plugin dependency/runtime binding 선언 surface와 실제 model·hook session은 검증하지 않았다.
- installable: **false** 유지. 공개 marketplace와 monolith 제거는 범위 밖이다.
