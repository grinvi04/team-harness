# 프론트엔드 디자인 표준 — 디자인 시스템·컴포넌트·함정

> 모든 프로젝트(grinvi04 산하)의 웹 프론트가 따르는 디자인 시스템 표준.
> 목표: 처음부터 **"상용 프리미엄 SaaS"** 수준 + 다크모드·반응형·접근성을 기본 탑재하고,
> erp 디자인 시스템 구축에서 실제로 겪은 함정을 새 프로젝트가 반복하지 않게 한다.
> 스택 기준: Next.js(App Router) · TypeScript · Tailwind v4 · shadcn/ui(@base-ui) · recharts.

---

## 0. 원칙 (한 줄씩)

- **토큰 먼저, 하드코딩 색 금지** — 하드코딩 회색/파랑은 다크모드를 깨뜨린다(가장 흔한 버그).
- **정제된 엔터프라이즈 미학** — 절제된 액센트 1색 + 카테고리 차트 팔레트 + 강한 타이포 계층 + 데이터 밀도. 화려함 아님.
- **정직한 UI** — 동작 안 하는 장식 컨트롤(가짜 검색·알림 배지) 금지.
- **검증은 스크린샷** — 라이트·다크·모바일을 Playwright로 실제 캡처해 눈으로 확인.

---

## 1. 디자인 토큰 (필수, 첫 작업)

`globals.css`에 **시맨틱 토큰**을 OKLCH로 정의하고 라이트·다크 둘 다 채운다. 화면 코드는 토큰만 쓴다.

필수 토큰군:
- 표면/텍스트: `background` `foreground` `card` `popover` `muted` `muted-foreground` `border` `input` `ring`
- 브랜드: `primary` `primary-foreground` `accent` `accent-foreground`
- **상태**: `destructive` **`success` `warning`** (+ `-foreground`) — 배지·경고·금액 증감에 필수
- **차트 팔레트**: `chart-1`~`chart-5` (인디고·틸·앰버·로즈·바이올렛 같은 **카테고리 구분색**). ⚠️ 회색 단색으로 두면 차트가 흑백이 된다.
- 사이드바: `sidebar` `sidebar-foreground` `sidebar-primary` `sidebar-accent`(+`-foreground`) `sidebar-border`

규칙:
- **하드코딩 색 0** — `text-gray-900`·`bg-white`·`text-blue-600`·`bg-blue-500` 등 금지. 매핑: 900/800/700→`text-foreground`, 600~300→`text-muted-foreground`, `bg-white`→`bg-card`, `bg-gray-50`→`bg-muted/40`, `border-gray-*`→`border-border`/`border-input`, blue→`primary`, green/emerald→`success`, red/rose→`destructive`, amber/yellow→`warning`.
- **차트 데이터색**은 `bg-primary`로 뭉치지 말고 `chart-1~5`로 카테고리 구분 유지.
- 다크 토큰을 반드시 같이 정의 — 안 하면 다크에서 글자가 안 보인다.
- 폰트: `--font-sans`/`--font-mono` 변수를 root layout의 폰트와 **이름 일치**시킬 것(불일치 시 폰트 미적용). 금액·수치는 `tabular-nums`.

---

## 2. 앱 셸

- **사이드바**: 토큰 기반(다크 슬레이트 콘솔 톤 권장), 브랜드 마크, 섹션 라벨, **접이식 그룹**, 절제된 활성 인디케이터(좌측 바+accent 배경), ScrollArea.
- **헤더**: 검색(커맨드 팔레트)·테마 토글·프로필 드롭다운. **반응형**: 사이드바 nav를 `SidebarNav`로 분리해 데스크톱 `<aside>`와 모바일 `<Sheet>` 드로어가 **재사용**하게.
- 레이아웃 배경도 토큰(`bg-muted/30`), `bg-gray-50` 금지.

---

## 3. 공통 컴포넌트 (프리미티브 — 화면 만들기 전에)

| 컴포넌트 | 역할 |
|---|---|
| `PageHeader` | 제목·설명·우측 액션 — 모든 화면 상단 통일 |
| `StatCard` | KPI(라벨·값·틴티드 아이콘 칩·추세 배지·옵션 href) |
| `EmptyState` / `ErrorState` | 빈/오류 상태 일관 |
| `ChartCard` | 차트/콘텐츠 카드(제목·설명·드릴다운 href) |
| `DataTable` | **정렬·행선택·일괄액션·스켈레톤·빈상태**(제네릭). 기본 `<Table>` 직접 쓰지 말 것 |
| `FormField` | 라벨·필수표시·**인라인 에러/힌트**(toast 검증 대체) |

- 폼 검증은 **FormField 인라인**(필드 옆 에러 + `aria-invalid`)으로. `toast.error`만 쓰지 말 것.
- 리스트는 처음부터 `DataTable`로. 나중에 31개 페이지를 일괄 교체하는 사태를 피한다.

---

## 4. 차트 (recharts)

- 색은 **`var(--chart-N)`** 문자열로 — 라이트/다크 자동 적응.
- **서버 컴포넌트 → 클라이언트 차트에 함수 prop 금지**(직렬화 불가). 포맷은 **직렬화 디스크립터**로: `valueFormat: {kind:'money',currency} | {kind:'suffix',suffix} | {kind:'number'}` 같이 넘기고 클라에서 포맷.
- 테마 툴팁(`bg-popover`·`border-border`), 축·그리드는 토큰색.
- 분포=도넛/가로막대, 시계열=세로막대. 시계열은 **데이터의 `month` 필드로 매핑**(배열 인덱스 의존 금지 — 희소 데이터에서 라벨이 어긋난다).

---

## 5. @base-ui / shadcn 함정 (실제로 막힌 것들)

- **`asChild` 없음 → `render` prop.** shadcn이 @base-ui 기반이면 트리거는 `<SheetTrigger render={<Button/>}>`. (radix의 `asChild` 아님)
- **체크박스 indeterminate**: `checked`+`indeterminate`+`onCheckedChange`. Indicator는 `checked||indeterminate`에 마운트되므로, indeterminate일 때 **MinusIcon**을 보이게 `group-data-indeterminate:` + `data-indeterminate:bg-primary` 스타일을 줘야 한다(안 하면 빈 박스에 체크표시처럼 깨진다).
- **recharts Tooltip payload는 readonly + dataKey가 함수일 수 있음** → 툴팁 props를 좁은/느슨한 타입(`ReadonlyArray<{dataKey?:unknown; value?:unknown}>`)으로 받아 우회.

## 6. React/Next 함정

- **`react-hooks/set-state-in-effect` lint**: effect 안에서 `setState` 직접 호출 금지.
  - 마운트 가드(테마 아이콘)는 effect 대신 **CSS `dark:` variant**로.
  - prop 변화 시 상태 리셋(DataTable 선택, 팔레트 검색어)은 effect 대신 **렌더 중 "이전 값 저장" 패턴**: `const [prev,setPrev]=useState(p); if(prev!==p){setPrev(p); reset()}`.
- **서버→클라 함수 prop 금지**(차트 포맷·콜백). 직렬화 가능한 값만.
- **DataTable 등 선택상태 컴포넌트**: `data`는 안정 참조로. 인라인 `.filter()`/`.map()`을 prop으로 주면 매 렌더 선택이 초기화된다.

## 7. 접근성·정직성

- 정렬 헤더에 `aria-sort`, 토글 버튼에 `aria-label`. 입력 오류에 `aria-invalid`.
- **동작 안 하는 컨트롤을 그리지 말 것** — 클릭해도 아무 일 없는 검색창, 읽지 않은 점이 켜진 가짜 알림 벨 등은 미완성/거짓 신호다. 실제 기능(커맨드 팔레트 등)을 붙이거나 제거.
- KPI에서 다중통화는 **기준통화 합계를 헤드라인 + 통화별 내역을 sub**로 — 카드 높이를 균일하게, 긴 문자열 잘림 방지.

---

## 8. 검증 (PR 전)

- `type-check` · `lint` · `build` 통과.
- **Playwright로 라이트·다크·모바일(+드로어) 실제 스크린샷** 캡처해 눈으로 확인(특히 차트가 다크에서 보이는지, 금액이 잘리지 않는지).
- 데이터 0인 테넌트면 데모 데이터를 시드해 차트·KPI를 실제로 본다(빈 화면으론 품질 판단 불가).

## 9. 적용

- **새 프로젝트**: §1 토큰 → §2 셸 → §3 프리미티브를 **화면 만들기 전에** 깔고 시작. 처음부터 DataTable·FormField·ChartCard로 화면을 만든다.
- **기존 프로젝트**: 토큰화(다크 정상화)부터 → 셸 → 프리미티브 도입 → 화면을 점진 마이그레이션(한 PR에 다 넣지 말고 응집 단위로).
