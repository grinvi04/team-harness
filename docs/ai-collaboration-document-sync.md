# Markdown 동기화 선언과 기계적 검사

[상위 문서](ai-collaboration.md)로 돌아간다. 아래는 원문의 해당 주제 본문을 순서대로 보존한 실행 계약이다. 상위 문서와 함께 적용한다.

#### 선언한 문서의 기계적 검사

`check-document-sync.mjs`는 기존 작업 기록 하나에 선언한 대상만 검사한다. 작업 스펙 또는 PR 본문에
아래 형식의 `harness-doc-sync` JSON fence 하나를 둔다. **실제 관련 문서의 누락·근거의 의미·시험 실행
여부는 독립 검토 대상**이며, 이 검사가 일반 Markdown 의미나 개발 완료를 보장하지 않는다.

````markdown
```harness-doc-sync
{
  "version": 1,
  "documents": [{"path": "docs/specs/task.md", "reason": "원래 수용 조건과 결과 대조"}],
  "items": [{
    "document": "docs/specs/task.md", "item": "릴리즈", "state": "pending",
    "resume": "릴리즈 담당자가 v1.2.0 발행 후 이 항목을 대조",
    "evidence": {"tag": "v1.2.0", "commit": "전체 40자리 구현 commit SHA로 교체"}
  }]
}
```
````

- `documents`는 존재하는 저장소 상대 파일과 대조·갱신 사유다. 변경 없음·과거 기록·재사용 서식도
  사유를 적을 수 있다. 서식의 미체크 항목을 `items`에 넣거나 일괄 완료 처리하지 않는다.
- `items`는 대상 문서에서 정확히 한 번 나타나는 체크박스 문구다. `done`은 `[x]`, `pending/deferred`는
  `[ ]`와 일치해야 한다. 선언 대상은 줄 앞 공백 0–3개의 `-/*/+` 체크박스다. fence 안이나 4칸 이상
  들여쓴 코드 예시는 제외하며, 더 깊은 중첩 목록 등 일반 Markdown 전체 구문은 해석하지 않는다. 상태 항목이 없는 문서는 `items: []`로 둔다.
- `done`에는 `evidence`가 필수다. 파일 근거는 `{"path":"docs/result.md","sha256":"전체 SHA-256"}`로
  연결한다(`shasum -a 256 docs/result.md`). 근거가 바뀌면 실패하므로 결과와 원래 계획을 다시 대조한다.
  digest만 새로 복사해서 통과시키지 않는다. 파일 존재·digest 일치는 실행 결과의 진실이나 후보 적합성의 증명이 아니다.
- 태그 근거는 정확한 `tag`와 그 태그가 포함해야 할 전체 `commit` SHA를 적는다. 완료는 태그 존재·commit
  ancestry를 검사한다. 대기 중인 태그가 이미 있으면 실패한다. 다음 릴리즈를 기다리면 그 후속 태그를 명시한다.
- `pending/deferred`에는 담당자·다음 행동 또는 재개 조건을 `resume`에 적는다. 텍스트의 적절성은 리뷰에서 확인한다.
- PR이 기존 스펙을 정본으로 쓰면 fence 내용은 `{"version":1,"record":"docs/specs/task.md"}`만 둔다.
  한 단계 연결만 허용한다. 별도 레지스트리를 만들거나 과거 스펙 전체를 매 PR 검사하지 않는다.
- 문서 영향이 정말 없으면 `{"version":1,"noImpact":"구체적인 비적용 이유"}`만 선언한다.
  CI 통과를 위한 일반 면제 문구로 쓰지 않으며, 리뷰에서 실제 diff와 대조한다.

로컬 명령(설치된 plugin 또는 이 저장소의 경로 사용):

```bash
node plugins/harness-guard/scripts/check-document-sync.mjs --repo . --record docs/specs/task.md
bash plugins/harness-guard/scripts/pr-create.sh --title "제목" --body-file /tmp/pr-body.md
```

PR wrapper는 선언이 있으면 push 전에 `--committed`로 검사해 모든 연결 파일이 HEAD에 있고 내용도 같은지
확인한다. 저장소 안에서 직접 지정한 선언 파일도 비교한다. 저장소 밖의 PR 본문 파일·stdin은 입력
스냅샷이며 HEAD 결박 대상은 그 안에서 연결한 파일이다. 일반 로컬 명령은 작성 중 작업트리를 읽으며,
커밋 후보를 확인하려면 `--committed`를 추가한다. 기존 소비 repo의 선언 없는 PR 생성은 호환성을 유지한다.
**이 저장소의 `quality` 잡은 PR 본문의 선언을 필수로 검사**하며 본문 편집에도 다시 실행한다. 소비 repo는
checker를 검토해 복사하거나 설치 경로를 사용해 기존 로컬 검사에 위 명령을 추가한다. PR CI에는 Node와
전체 Git 이력·태그를 준비한 뒤 `--record` 대신 `--event "$GITHUB_EVENT_PATH"`를 사용하고
`pull_request.types: [opened, synchronize, reopened, edited]`를 설정한다. 기존 required check 안에 연결할 수
있으며 보호 정책 변경·새 플랫폼 설치는 필요 없다. 기존 repo에는 자동 전파되지 않는다.

태그는 **현재 로컬 Git refs만** 읽는다. 태그 기준 판정 전 담당자가 원격을 확인하고
`git fetch origin --tags`로 갱신한다(CI checkout은 `fetch-depth: 0`). 조회 실패를 성공으로 취급하지 않는다.
병합·릴리즈 후 담당자는 연결된 작업 기록으로 같은 명령을 다시 실행한다. 태그 발행 자체가 이 PR 검사를
자동 실행하지는 않는다. 실행되지 않은 후속 단계·미선언 문서·링크된 PR의 원격 상태를 자동 확인했다고
보고하지 않는다. 과거 고정 기록은 당시 후보·시점으로 보존하고 현재 작업에 필요한 선언만 새로 대조한다.
