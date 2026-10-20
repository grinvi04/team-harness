# 로컬 실행 관측 대시보드

Harness의 검사·차단·전달 사건을 읽기 전용 화면에서 확인한다. 실행·승인·병합은 기존 workflow가 담당한다.
이 기능은 현재 개발 후보이며 아직 정식 발행되지 않았다. 실제 격리 Codex CLI의 hook→기록→화면은
확인했다. 승인된 Desktop 시험·설치 복구도 확인했다. 최종 PR 통합·발행·설치는 아래 실행 기록의 원본을 따른다. Claude 실호스트는 미확인 보류다.
후보·실행 범위·남은 검증은 [현재 실행 기록](../pilots/local-runtime-dashboard.md)을 따른다.

## 처음 실행하기

관측 스크립트와 생성된 `dashboard/`가 함께 있는 **같은 후보의 플러그인 루트**를 사용한다.
설치된 후보의 실행에는 Node.js·Git이 필요하며 npm 설치나 화면 빌드는 필요 없다.
소스 제작자는 먼저 아래 [제작·재현](#제작재현)을 수행한다. Vite 개발 서버를 설치 실행기로 사용하지 않는다.

1. 관측할 Git 저장소 또는 worktree와 사건을 보관할 전용 데이터 디렉터리를 정한다.
   데이터 디렉터리의 부모는 이미 존재해야 한다. 경로에 symlink를 사용하지 않는다.
   viewer는 마지막 디렉터리만0700으로 생성한다. 기존 디렉터리는 현재 사용자 소유·0700이어야 한다.
2. 실제 절대 경로로 다음 명령을 실행한다. `--repo`·`--data-dir`는 모두 필수다.

```bash
node "/path/to/plugin/scripts/observe.mjs"   --repo "/path/to/product-worktree"   --data-dir "/existing/private-parent/observability"
```

3. 터미널에 출력된 `http://127.0.0.1:임의포트/#접근토큰` 주소를 브라우저에서 연다.
   주소의 토큰은 프로세스마다 달라진다. 화면이 fragment를 읽으면 즉시 주소에서 지운다.
   접근 토큰과 화면 캐시는 브라우저 메모리에만 남는다. 새로고침했다면 **터미널의 CLI 주소를 다시 연다**.
   시작 시 기존 기록의 검증이 끝난 뒤 수집을 활성화한다. viewer가 소유하는 전용 writer는 자동으로 시작·종료된다.
4. 대상 별칭·worktree·branch·현재 SHA를 확인한다. viewer 하나는 실행 시 고른 worktree에 고정된다.
   다른 worktree는 해당 대상으로 viewer를 실행하고 새 CLI 주소를 같은 탭에서 연다. 화면 내부 선택기는 없다.

## 실제 실행과 기록 연결

viewer가 켜졌다는 사실만으로 hook·wrapper의 기록 경로가 연결되지는 않는다.
CLI가 쓴 활성 표식과 실제 writer의 경로·repo·worktree가 일치해야 새 사건이 기록된다.

- Codex hook은 **호스트가 실제 제공한 `PLUGIN_DATA` 아래 `observability/`**를 사용한다.
  임의로 설치 경로를 추정하지 말고 실제 제공된 데이터 경로를 확인해 viewer의 `--data-dir`와 맞춘다.
  `PLUGIN_DATA`가 없으면 Codex 관측 adapter는 기록하지 않는다.
  관측 대상은 hook이 받은 대화의 작업 폴더다. Git 저장소 안에서 연 대화를 사용하고 viewer의 `--repo`를
  그 worktree와 맞춘다. 개별 명령의 작업 폴더만 바꿔도 대화의 관측 대상이 바뀌지는 않는다.
- 터미널에서 wrapper나 명시 검사를 실행할 때는 같은 `HARNESS_OBSERVE_DIR`를 그 실행에 전달한다.
  환경변수는 viewer가 다른 프로세스에 자동 주입하지 않는다. 작업 디렉터리도 선택한 worktree여야 한다.
- 기존 guard·PR wrapper를 평소 경로로 실행한다. 명시 검사만 기록하려면 제품 worktree에서 다음처럼 감싼다.
  아래 예시는 Node 버전 조회만 확인하며 제품 전체 검사 통과를 뜻하지 않는다.

```bash
HARNESS_OBSERVE_DIR="/existing/private-parent/observability"   node "/path/to/plugin/scripts/observation/run-check.mjs" --id node-version -- node --version
```

사건은 위 전용 디렉터리의 이벤트별 파일로 디스크에 남는다. 원문 명령·출력·prompt·토큰은 기록하지 않는다.
파일0600·디렉터리0700이며32 MiB 또는7일 중 먼저 도달하는 한도로 보관한다. 삭제·깨진 기록·순서 누락은
관측 손실로 표시할 수 있지만 기록 실패한 모든 사건의 개수를 알 수 있는 것은 아니다.

## 화면에서 판단하기

대상 → 현재 작업 → 차단 이유·다음 행동 → 타임라인·선택 근거 순서로 읽는다.
명시 검사는 `--id`로 이름을 구분한다. 규칙별 차단 이유·다음 행동을 읽으며, 과거 기록의 미제공 값을 추정하지 않는다.
작업 필터·상세 버튼은 키보드로 조작한다. 과거 기록을 스크롤하면 자동 이동이 멈추며 새 사건 수와 재개 버튼을 제공한다.

| 화면 표시 | 해석 |
|---|---|
| 현재 상태 미확인 | 사건 부재·현재 후보 근거 부재·조회 오류·복귀 재조회 전; 마지막 캐시를 현재 성공으로 보지 않음 |
| 종료 미확인 | 시작은 관측했으나 종료 사건이 없음; 시간만으로 완료·실패를 추정하지 않음 |
| 검사 통과·PR 생성·원격 병합 확인 | 해당 사건이 확인한 범위만 읽음; HTTP 조회 성공은 gate PASS가 아님 |
| 복구 시도·복구 미확인 | 보호 원값의 재조회 일치가 확인되기 전까지 복구 완료로 보지 않음 |
| 이전 후보의 근거 | 현재 SHA와 다름; 현재 후보의 성공 근거로 합치지 않음 |

응답은8MiB 안에서 최신 작업부터 작업 전체 단위로 표시하며 생략 작업 수를 알린다. 화면 생략은 디스크 기록을 지우지 않는다.
최신 작업 하나만으로 한도를 넘으면 작업을 부분 표시하지 않고 현재 상태 미확인으로 남긴다.

활성 화면은2초 간격으로 조회한다. 숨긴 탭은 조회를 멈추고 복귀 시 즉시 재조회하며 확인 전에는 현재 상태를 확정하지 않는다.

## 종료·기록 지우기

viewer를 실행한 터미널에서 **Ctrl+C**로 종료한다. 자신이 쓴 활성 표식만 해제하며 기존 사건 파일은 남긴다.
writer가 먼저 비정상 종료하면 자기 표식을 해제하고 손실을 표시한다. viewer 비정상 종료의 표식은 마지막 갱신 후30초에 만료한다. 같은 대상의 다른 활성 viewer가 있으면 수집이 이어질 수 있다.
기록을 지우려면 해당 경로를 사용하는 viewer·writer를 먼저 종료하고 필요한 실행 증거를 보존한다.
그 뒤 **처음 지정한 관측 전용 디렉터리만** 삭제한다. 상위 `PLUGIN_DATA` 전체나 다른 플러그인 데이터는 지우지 않는다.
다음 실행에서 같은 전용 경로를 다시 생성할 수 있다. 화면에서 기록을 수정·삭제하는 API는 없다.

## 연결되지 않을 때

| 증상 | 확인할 것 |
|---|---|
| 시작 실패 | 같은 후보의 배포 asset·manifest, 기존 부모 경로, 실제 Git 대상, 소유자·0700·symlink 여부 |
| 수집 미연결 | viewer 실행 여부, writer와 같은 데이터 경로·repo·worktree인지, 활성 표식 만료 여부 |
| hook 연결 미확인 | 실제 hook 사건을 받았는지; 플러그인 파일 존재·설치 목록만으로 연결을 확정하지 않음 |
| 연결 끊김·현재 상태 미확인 | viewer 터미널 상태와 마지막 관측 시각; 재시작했다면 새 CLI 주소를 다시 열기 |
| 새로고침 후 접근 주소 필요 | 주소에서 제거된 메모리 토큰은 복구하지 않음; 터미널의 전체 CLI 주소 다시 열기 |
| 관측 손실 의심·기록 오류 | 권한·용량·깨진 파일·보존 삭제를 확인하고 기존 근거를 보존; 캐시 PASS로 대체하지 않음 |

관측은 기존250ms 제한 안에서 처리한다. 과도한 대기·기록 실패는 손실 의심이며 무손실을 보장하지 않는다.
관측 실패는 기존 명령의 허용·거부·exit를 바꾸지 않는다. 화면이 비어 있다는 이유로 실행 허용이나 성공을 추정하지 않는다.

## 제작·재현

이 절은 Team Harness 소스 개발용이다. root `dashboard/`의 React·TypeScript·설정·lockfile이 제작 정본이고,
`plugins/harness-guard/dashboard/`는 생성해 커밋하는 배포 asset과 `asset-manifest.json`이다. 직접 편집하지 않는다.
제작 Node는 `dashboard/.node-version`, npm은 `dashboard/package.json`의 `packageManager`에 고정한다.
소스 저장소 루트에서 실행한다.

```bash
npm ci --prefix dashboard
npm run lint --prefix dashboard
npm run typecheck --prefix dashboard
npm run test:unit --prefix dashboard
node scripts/build-dashboard.mjs --write
node scripts/build-dashboard.mjs --check
```

`--write`는 관리 중인 생성 파일만 교체·정리한다. 예상 밖 파일은 보존하고 실패한다.
`--check`는 임시 경로에 재빌드한 파일 목록·바이트를 양방향 비교하며 배포 경로를 수정하지 않는다.
CI는 의존성·소스 검사를 수행하고 생성물에는 `--check`만 사용한다. 소비자 설치 시에는 빌드하지 않는다.
빌드는 상대 asset 경로·source map OFF·격리 env 디렉터리를 사용하며 자식 환경의 `VITE_*`를 제거한다.
정적 화면에는 사용자 데이터·접근 토큰을 넣지 않는다. package·bundle은 커밋된 후보를 기준으로 검증한다.
