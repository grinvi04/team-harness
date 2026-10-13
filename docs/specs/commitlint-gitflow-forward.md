# 순차 Git Flow의 순수 develop 전달 검사

## 문제·범위

2026-10-14, 순차 Git Flow를 지키라는 사용자 지시에 따라 PR562를 develop에 먼저 병합하고
실제 병합 SHA417066a에서 release/docs PR564를 만들었다. 기존 target CI는 보호된 develop
이력을 제외한 뒤 고유 커밋이 0개이면 validator의 빈 범위 거부로 실패했다.
실패 run38480322255와 원문은 `.runtime/team-guide-delivery-20261014/`에 보존한다.

제품 방향은 **소유**다. 기존 CI의 보호된 상위 이력 제외 계약과 실제 순차 전달을 연결한다.
현재 release 후보에서 최소 수정하고 같은 main PR의 새 후보 리뷰·CI 뒤 develop으로 역병합한다.
정본 템플릿·배치 사본·설치 digest를 함께 갱신하고 소스 PATCH0.93.2로 올린다.
발행·설치·소비 저장소·원격 보호 변경·Claude 실제 검증은 범위 밖이다.

## 변경·보존 계약

- 열린 main PR의 전체 base..head 범위가 실제 비어 있으면 계속 실패한다.
- 전체 범위가 있고 develop 제외 후 고유 커밋이 없는 `release/*` 후보만 순수 전달로 허용한다.
  실제 fetch·현재 PR head 일치·유효 metadata 확인을 수행한다. 본문·버전 문구를 신뢰하지 않는다.
- release 이외의 고유 커밋 없는 main 후보는 거부한다. 고유 커밋이 있으면 기존 validator로 검사한다.
- develop 미조회·Git 판독 실패·stale head·잘못된 metadata·새 커밋 규약 위반은 계속 실패한다.
- 필수 job/context·read-only token·trusted checkout·PR 코드를 실행하지 않는 경계를 유지한다.
- merged edited의 기존 비적용과 develop 전체 검사·main 역병합·고유 해결 커밋 검사도 유지한다.
- 기존 빈 범위 validator를 완화하지 않는다. 실제 범위를 구분하는 workflow 분기만 수정한다.

## QA와 완료 기준

실제 workflow shell·격리 Git 객체·trusted validator를 기존 시험에서 실행한다.
보호된 develop에 먼저 포함된 열린 release의 opened/edited/reopened가 성공하고 PR 코드 실행은 0이어야 한다.
수정 전 이 순수 전달의 실패(RED)와 수정 후 성공을 보존한다. 기존 오판 fixture는 진짜 빈 base..head와
이미 검사된 상위 이력을 혼동했으므로 두 입력을 분리하고 진짜 빈 범위 거부를 명시적으로 유지한다.
다른 branch·invalid 고유 커밋·조회 실패·stale head·상태 모순·고유 역병합 위반의 거부도 확인한다.
정본 byte parity·fallback digest·구문·버전·문서 현행화·전체 quality CI와 독립 안전 검토가 필수다.

로컬 수정·main 적용·develop 동기화는 별도 상태다. 수정 전 순수 전달 RED와 수정 후 정상·거부 검증을
같은 실행 기록에 보존한다. 이 명세의 계약이 원격 반영됐는지는 아래 PR 원본으로 판단한다.
현재 전달 상태는 [PR564](https://github.com/grinvi04/team-harness/pull/564)와 연결 역병합 PR에서 확인한다.
과거 #539의 실패·계약은 당시 후보로 보존하며 현재 순수 전달 구분은 이 명세를 따른다.
