# 앱 업데이트와 실행 위치 검토

2026-10-09 KST. 사용자는 Claude·ChatGPT 데스크톱 앱 업데이트를 완료했다고 알렸다.
이번 확인은 로컬 버전 조회와 공식 지원 문서의 대조다. 업데이트·설치·설정 수정·클라우드 환경 생성은 수행하지 않았다.

## 현재 확인한 실행기

| 대상 | 관찰값 | 판정 범위 |
|---|---|---|
| ChatGPT.app | 26.1002.52244 / build 13536 | 설치 앱의 Info.plist; 계정별 모든 최신 기능의 활성화를 증명하지 않음 |
| ChatGPT 내장 Codex | 0.162.0-alpha.2 | 앱 내부 바이너리의 version 출력; 현재 채팅에서 모든 옵션이 적용됨을 증명하지 않음 |
| 터미널 Codex | 0.161.0 | 사용자 업데이트 후 실제 version 재확인; 초기 0.156.1과 구분 |
| Claude.app | 2.26454.2 | 설치 앱의 Info.plist; 이후 패키지 target 2.1.293·설치 binary 2.1.205를 구분해 확인; 현재 실행 모델/effort는 미확인 |
| 터미널 Claude Code | 2.1.267 | ~/.local/bin/claude가 같은 버전 파일로 연결됨; 앱 내부 버전을 뜻하지 않음 |

터미널 업데이트 후 [버전·현재 원본](../planning-source-state.json)을 다시 확인했다. 앱 값은 앞선 설치 관찰이며 이번 터미널 확인으로 앱 내부 실제 적용을 증명하지 않는다.
Codex version은 exit 0이며 sandbox의 PATH alias 생성 경고가 있었다. 이는 모델 호출 실패가 아니다.
앱 업데이트를 CLI·Harness plugin·역할 정의의 자동 업데이트로 취급하지 않는다.
[Claude 공식 모델 계약](https://code.claude.com/docs/en/model-config)은 5.5 계열에 CLI 최소 버전을 명시한다.
현재 터미널 선택값은 그 최소 버전보다 낮지만, 이 사실만으로 업데이트된 데스크톱 앱도 지원하지 않는다고 결론내리지 않는다.
수정 단계에서는 실제 사용할 surface를 먼저 정하고 그 실행기의 alias·최종 model/effort·plugin 로딩을 확인한다.
추가 대조에서 Codex config 파일의 바이트 digest는 이전 감사와 달라졌다. 이번 작업에서 원본 설정을 편집하지 않았으며 변경 주체·전체 차이는 확정하지 않았다.
재조회한 기본 Sol 6.1/medium, review Astra, plan high, sandbox·메모리 생성/조회 값은 앞선 관찰과 같다. 과거 전체 config 검증을 현재 파일 전체의 PASS로 이월하지 않는다.

## 로컬 실행과 모델 추론은 다른 위치다

여기서 로컬은 코드·파일·명령·도구 작업이 사용자 컴퓨터에서 실행된다는 뜻이다.
현재 검토하는 GPT/Claude 제공 모델의 추론을 사용자 Mac에서 돌리는 뜻은 아니다.
[OpenAI의 데이터 흐름 설명](https://learn.chatgpt.com/docs/hipaa-configuration#shared-responsibility)은 Codex 입력을 추론 서비스에 보내고 출력을 받는 구조를 설명한다.
위 문서의 의료·Enterprise 조건을 이번 사용자 계정에 적용했다는 뜻은 아니다. 이번에는 inference provider를 변경하지 않았다.

## 현재 작업에는 로컬을 권고한다

현재 대상은 실제 ~/.codex·~/.claude·공통 지침·역할·셸 진입부·설치 plugin과 다섯 로컬 저장소다.
따라서 이 원본에 접근하고 실제 로컬 hook/설정의 집행을 확인할 수 있는 로컬 환경을 권고한다.
향후 구현은 로컬 worktree로 분리할 수 있다. worktree는 저장소 변경을 격리하며 사용자 홈 전역 설정까지 격리하지는 않는다.
이는 현재 작업에 대한 권고이며 사용자가 로컬/클라우드 이관을 새로 승인한 것으로 기록하지 않는다.

| 작업 성격 | 우선 실행 위치 | 이유·필요 조건 |
|---|---|---|
| 전역 설정·로컬 hook·CLI·plugin 적용 검증 | 로컬 | 실제 파일·설치·실행기의 동작이 검증 대상 |
| 로컬 서버·브라우저·DB·macOS 동작 재현 | 로컬 | 컴퓨터의 서비스·도구·접속 상태를 사용해야 함 |
| 원격 저장소만으로 재현되는 장시간 코드 작업 | 클라우드 후보 | 의존성·검사·권한을 재현해 놓으면 컴퓨터가 잠들어도 진행 가능 |
| 깨끗한 환경의 회귀 시험·독립 검토 | CI 또는 클라우드 후보 | 고정 후보·필수 검사·원래 수용 기준·재현 가능한 설정 필요 |

## 클라우드로 옮길 때의 계약

[Codex 환경 구분](https://learn.chatgpt.com/docs/environments/modes): Local/Worktree는 컴퓨터에서 실행되고 Cloud는 별도 환경의 작업 파일을 쓴다.
로컬 파일·프로세스·브라우저 로그인·VPN은 자동 이전되지 않는다. 개인 skill도 cloud 환경에 자동 동기화된다고 가정하지 않는다.
[Codex Cloud](https://learn.chatgpt.com/docs/environments/cloud-environments)는 게시한 환경에서 격리된 작업 공간을 만들고 컴퓨터가 잠든 동안에도 작업한다.
저장소·의존성·검사 명령·접근 설정을 준비해야 하며, 환경 생성·게시·계정 연결은 이번에 하지 않았다.

[Work Cloud의 local access 계약](https://learn.chatgpt.com/docs/enterprise/cloud-local-access#check-hooks-and-network-compatibility)은 cloud orchestration에서 로컬 command/plugin hook을 지원하지 않는다고 명시한다.
도구가 내 컴퓨터에서 실행되는 혼합 경로도 순수 로컬과 같지 않다. Enterprise remote MCP hook은 별도 기능이며 개인 계정에 적용하지 않는다.
이 제한을 모든 공급자의 모든 cloud hook이 미지원이라는 주장으로 확대하지 않는다.

[Claude cloud](https://code.claude.com/docs/en/claude-code-on-the-web)는 별도 환경의 세션이며 노트북을 닫아도 진행할 수 있다.
Claude cloud 사용량은 다른 Claude/Claude Code와 계정 한도를 공유한다. 로컬 사용자 설정·인증·저장소 변경의 이전은 해당 경로의 계약을 따로 확인한다.
클라우드에 갔다는 이유로 더 저렴하거나 모델의 추론 품질이 좋아졌다고 단정하지 않는다.
모델·effort·입력·도구·환경을 같게 맞춘 뒤 결과를 비교하고, 추가 계정·비밀 전송·결제는 기존 승인 범위를 넘지 않는다.

## 적용 전 남은 확인

1. 로컬 앱/CLI 중 실제 사용할 surface의 최종 모델·effort·hook·plugin 적용을 격리 후보에서 확인한다.
2. Luna/Haiku의 낮은 단가와 높은 effort 조합은 [모델 시험 후보](05-model-global.md)에 포함하되 상시 max의 최적성은 주장하지 않는다.
3. 클라우드를 도입할 경우 로컬의 필수 정책을 CI/native 지원 경로에서 어떻게 집행할지 정하고 허용·거부 사례를 확인한다.
4. 로컬 PASS를 cloud PASS로 옮기지 않는다. 실행 환경이 달라지면 영향 범위에서 다시 검증한다.

추가 [실제 호출·앱 내부 조사](10-agent-owned-execution.md): Codex 세 설정의 실행 metadata/품질/사용량과 Claude target·설치 binary·설정 schema를 연결했다. 원본 업데이트는 수행하지 않았다.
