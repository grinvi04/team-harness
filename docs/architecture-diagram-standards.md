# 아키텍처 다이어그램 — 커스텀 다크 테마 SVG (선택적 고급 방식)

> **정본은 mermaid→PNG다** — `readme-standards.md §4`가 규정하는 `docs/architecture.png`
> (mermaid 소스를 `<details>`에 병행)가 모든 repo의 **기본·정본**이다.
> 이 문서는 **픽셀 단위 다크테마 레이아웃이 꼭 필요한 repo만** 택하는 **선택적** 커스텀 SVG 방식이다.
> 기존 SVG 산출물(webhook-service·siku·DriveTree)은 그대로 유효 — **강제 마이그레이션 없음**(신규만 mermaid→PNG 기본).
> 생성기 스크립트: [`templates/gen_arch_svg.py`](../templates/gen_arch_svg.py)

---

## 1. 언제 커스텀 SVG를 쓰나 (정본 아님)

기본은 mermaid→PNG(readme-standards §4). 아래 이점이 **실제로 필요할 때만** 이 방식을 택한다:

| 방식 | 장점 | 단점 |
|---|---|---|
| **mermaid→PNG (정본)** | 텍스트 소스 git diff·유지보수 쉬움, 빠른 작성, GitHub 웹 렌더 | 다크 테마 제한, 박스 위치 제어 불가 |
| 커스텀 SVG (선택) | 다크 테마, 픽셀 단위 레이아웃, 라벨 충돌 검증 | 초기 작성 비용·스크립트 유지비 |

**원칙**: 기본은 `docs/architecture.png`(mermaid). 커스텀 SVG를 택한 repo만 `docs/architecture.svg`를 쓰고,
어느 경우든 README는 `![아키텍처 다이어그램](docs/architecture.{png\|svg})` + mermaid 소스를 `<details>`에 병행한다(readme-standards §4 준수).

---

## 2. 색상 팔레트

배경: `#0f172a` (BG) / 콘텐츠 영역: `#1e293b` (AREA)

| 타입 키 | 의미 | stroke | fill | text |
|---|---|---|---|---|
| `client` | 사용자 / 브라우저 | `#94a3b8` | `#1e293b` | `#e2e8f0` |
| `fe` | 프론트엔드 | `#60a5fa` | `#1e3a8a` | `#bfdbfe` |
| `proxy` | 프록시 / 게이트웨이 | `#38bdf8` | `#0c4a6e` | `#bae6fd` |
| `api` | API / 백엔드 | `#4ade80` | `#14532d` | `#bbf7d0` |
| `queue` | 큐 / 워커 | `#fb923c` | `#7c2d12` | `#fed7aa` |
| `db` | 데이터베이스 | `#34d399` | `#065f46` | `#a7f3d0` |
| `dlq` | Dead Letter Queue / 에러 | `#f87171` | `#7f1d1d` | `#fecaca` |
| `auth` | 인증 / 인가 | `#c084fc` | `#4a044e` | `#e9d5ff` |
| `edge` | Edge Function / 서버리스 | `#818cf8` | `#312e81` | `#c7d2fe` |
| `monitor` | 모니터링 / 옵저버빌리티 | `#818cf8` | `#312e81` | `#c7d2fe` |
| `storage` | 스토리지 / 오브젝트 | `#2dd4bf` | `#134e4a` | `#99f6e4` |
| `external` | 외부 서비스 / 써드파티 | `#fbbf24` | `#78350f` | `#fde68a` |
| `ci` | CI/CD | `#a78bfa` | `#3b0764` | `#ddd6fe` |

---

## 3. 박스 크기와 간격

```
BW = 130    # 박스 너비 (px)
BH = 80     # 박스 높이 (px)
BR = 10     # 모서리 반경 (px)

center-to-center spacing = 270px   # 수평 인접 노드 간
gap = 140px                        # 박스 사이 순수 공백
```

레이아웃 결정 기준:
- 노드 수 × 270 + 여백(~90px 양쪽) → 캔버스 너비 W
- 행 수 × 180 + 헤더(90px) + 범례(60px) → 캔버스 높이 H
- 단일 행 y = H / 2 기준, 상/하 행은 ±155~165px

---

## 4. 레이아웃 패턴

### 4.1 선형 파이프라인 (webhook-service 형)

```
[A] ─── [B] ─── [C] ─── [D] ...
         │
        [E]  ← 상단 서비스 (y - 155)
         │
        [F]  ← 하단 모니터링 (y + 180)
```

- 모든 수평 연결은 **오른쪽 에지 → 왼쪽 에지** 직선
- 상단/하단 서비스는 주 파이프 노드에서 수직 직선
- 예외(sync 등 비정상 경로)만 베지어 곡선 + `dash=True`

### 4.2 단일 소스 팬아웃 (siku 형)

```
[소스] ─── [서비스1]
     └──── [서비스2]
     └──── [서비스3]
     └──── [서비스4]
```

- 소스 **오른쪽 에지(x = cx + BW/2)** 에서 출발
- 각 서비스 **왼쪽 에지(x = cx - BW/2)** 로 직선
- 출발점을 소스 박스 내부에서 y값을 살짝 분산(2~8px 간격)시켜 화살표 출발점을 구분
- **모든 중간점 x = (출발x + 도착x) // 2** → 서비스 컬럼 왼쪽을 절대 침범 안 함 → 충돌 없음

### 4.3 CI/CD V자 대각선 (DriveTree 형)

```
      [CI]
     /    \
[FE]      [BE]
```

- CI 중심이 FE와 BE의 정중앙에 위치할 때 양쪽 대각선은 **완전 대칭**
- 출발점: `(ci_cx ± offset, ci_cy + BH/2)`, 도착점: `(fe_cx, fe_cy - BH/2)`
- `offset = (be_cx - fe_cx) // 2 // 3` 정도로 자연스러운 각도 조절
- 반드시 `dash=True` (배포=비기능 경로)

---

## 5. 화살표 규칙

| 규칙 | 적용 |
|---|---|
| **직선 우선** | 연결 경로에 다른 박스가 없으면 항상 직선(`line()`) |
| **박스 관통 금지** | 화살표가 어떤 박스의 rect를 통과하면 안 됨 — 레이아웃을 바꿔서 해결 |
| **베지어는 예외 경로만** | sync bypass, 비기능 경로 등에만 `curve()` 사용 |
| **대시(dash=True)** | 비동기·옵션·배포 경로 — 실선은 주 데이터 흐름만 |
| **화살표 머리** | 항상 선 끝(목적지)에 `marker-end` |

화살표 색상:
- 실선: `#94a3b8` (stroke), `stroke-width: 2`
- 대시: `#64748b` (stroke), `stroke-width: 1.5`, `stroke-dasharray: 6 3`

---

## 6. 라벨 배치

```python
def lbl(lx, ly, text):
    w = sum(14 if ord(c) > 127 else 8 for c in text) + 14  # 한글 14px, ASCII 8px
    # 다크 배경 rect (y-13 ~ y+4, 높이 17)
    # 흰색 텍스트 baseline = ly
```

- **위치**: 화살표 중간점 (`(x1+x2)//2`, `(y1+y2)//2 - 7`)
- 수동 오프셋이 필요할 때 `lx=`, `ly=` 파라미터로 지정
- **충돌 검증 필수** (아래 §7)

라벨 텍스트 스타일:
```
font-family: 'Segoe UI', system-ui, sans-serif
font-size: 11px
font-weight: 600
fill: #e2e8f0
background-rect fill: #0f172a, opacity: 0.92, rx: 3
```

---

## 7. 충돌 검증 — check_labels()

모든 다이어그램 생성 함수에 `check_labels()` 호출 **필수**:

```python
ok = check_labels('diagram_name', boxes_list, [(lx, ly-7, text) for lx, ly, text in labels])
```

- `boxes_list`: `[(cx, cy, name), ...]`
- `labels`: `[(lx, ly, text), ...]` — `ly`는 텍스트 baseline (lbl 함수가 `ly-13 ~ ly+4` rect 생성)
- 충돌 발견 시 콘솔에 `OVERLAP` 출력 → **수정 후 재생성**
- 충돌 해결 방법: 라벨 오프셋 수동 지정 또는 레이아웃 재배치

---

## 8. SVG 구조

```
<svg viewBox="0 0 W H">
  <defs> arrowhead markers (arr, arr-dash) </defs>
  <rect fill="#0f172a"/>                     ← 전체 배경
  <text> 제목 (20px, bold, #f1f5f9) </text>  ← x=48, y=42
  <text> 부제 (12px, #64748b) </text>        ← x=48, y=62
  <rect rx="12" fill="#1e293b"/>             ← 콘텐츠 영역 (x=28, y=72)
  {boxes}
  {edges + labels}
  {legend}
</svg>
```

범례(legend): 콘텐츠 영역 하단 50px 위, `font-size: 11px, fill: #94a3b8`

---

## 9. 신규 프로젝트 다이어그램 생성 절차

1. `templates/gen_arch_svg.py`를 프로젝트 `docs/gen_arch_svg.py`로 복사
2. 프로젝트 노드 좌표 설계 (아래 참고)
3. 레이아웃 패턴 선택 (§4)
4. `check_labels()` 통과 확인
5. 생성 실행: `python3 docs/gen_arch_svg.py`
6. 출력: `docs/architecture.svg`
7. README `🏗️ 아키텍처` 섹션에 `![아키텍처 다이어그램](docs/architecture.svg)` + mermaid `<details>`
8. **자동 재생성 훅**(권장): `templates/hooks/regen-arch-svg.sh`를 `.claude/hooks/regen-arch-svg.sh`로 복사(`chmod +x`)하고
   프로젝트 `.claude/settings.json`의 `hooks.PostToolUse`(matcher `Edit|Write|MultiEdit`)에 배선한다 — 이후
   `docs/gen_arch_svg.py`를 저장할 때마다 SVG가 자동 재생성된다(수동 `python3` 실행 불필요). 훅은 대상 파일이
   `docs/gen_arch_svg.py`가 아니면 즉시 exit 0이라 다른 편집엔 무영향. 배선 예:
   ```json
   "PostToolUse": [
     { "matcher": "Edit|Write|MultiEdit", "hooks": [
       { "type": "command", "command": "bash ${CLAUDE_PROJECT_DIR}/.claude/hooks/regen-arch-svg.sh", "timeout": 15 }
     ]}
   ]
   ```
   > 훅 스크립트의 **단일 출처 = `templates/hooks/regen-arch-svg.sh`** — repo마다 복붙하지 말고 이 템플릿에서 복사한다.

### 노드 좌표 설계 체크리스트

- [ ] 노드 수 × 270 → W 확정, 여백 80~90px
- [ ] 행별 y 확정 (주행: H/2, 상단: y-155, 하단: y+165 정도)
- [ ] 화살표 경로 사전 스케치 → 박스 관통 여부 확인
- [ ] 팬아웃 구조라면 중간점 x가 서비스 컬럼 왼쪽보다 작은지 확인
- [ ] CI/CD 노드는 FE·BE 정중앙 x에 배치
- [ ] 라벨 충돌 → check_labels() 통과

---

## 10. 적용 사례

| 프로젝트 | 패턴 | 노드 수 | W × H |
|---|---|---|---|
| webhook-service | 선형 파이프라인 (3행) | 10 | 1560 × 580 |
| siku | 단일 소스 팬아웃 | 6 | 830 × 575 |
| DriveTree | 선형 + CI V자 대각선 | 5 | 1030 × 430 |
