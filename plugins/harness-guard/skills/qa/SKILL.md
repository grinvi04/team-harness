---
name: qa
description: 프론트엔드 QA — 디자인 토큰 준수 + WCAG 2.2 접근성 검증 (stack-agnostic)
---

# /qa — 프론트엔드 디자인·접근성 QA

## Codex 실행

Claude의 Explore/Haiku/background 표기는 역할 분리 설명이다. Codex에서는 디자인 토큰, WCAG, 한국어 UX 검사를
같은 체크리스트와 검증 명령으로 수행하며, 병렬 agent 실행을 지원하지 않는 세션에서는 순차 실행한다.

**사용법**: `/qa`
UI 변경 후 디자인 시스템 준수와 접근성을 검증한다.

> **스택 의존 값은 repo의 `AGENTS.md`에서 읽는다** — 프론트 소스 디렉터리, 디자인 스펙 파일(예: `DESIGN_IMPL.md`),
> lint/a11y 도구 명령(stylelint·eslint-plugin-jsx-a11y·axe-core/Playwright·jest-axe 등).
> **프론트엔드가 없는 repo면** "프론트엔드 없음 — 디자인 QA N/A" 출력 후 종료.

> ⚠️ **스코프**: 이 게이트는 결정론적 린터 + 정적/렌더 DOM 스모크까지만 책임진다. 풀 수동 감사(스크린리더 실청취·실키보드 워크스루·400% 줌 실측)는 범위 밖 = 사용자 액션.

---

## 통과 기준 · 검증

| 항목 | 통과 기준 | 검증 방법 |
|---|---|---|
| 디자인 토큰 | 린터 위반 0 (blocking) | AGENTS.md 토큰 린트 명령 `exit 0`. 린터 미설정 → "린터 미설정" 명시(휴리스틱 발견은 advisory로만, 통과 단정 금지) |
| 접근성 | '위반' 버킷 0 ('판정불가'는 needs-review로 분리) | a11y 도구 `exit 0`, 또는 정적 점검 위반 0 + 미검증 항목 disclaimer |

**린터 위반이 있으면 'QA 통과'를 출력하지 않는다** → 머지 차단 권고. 통과 시에도 정적 미검증 항목 disclaimer를 항상 출력(false pass 방지). 이 게이트의 책임 범위는 결정론적 린터 + 정적/렌더 DOM 스모크까지 — 풀 수동 감사는 사용자 액션.

---

## Agent A — 디자인 토큰 준수 (`subagent_type: Explore`, `model: haiku`, `run_in_background: true`)

**디자인 스펙이 선언된 repo만 실행** (미선언 → "디자인 스펙 없음 — 스킵").

1. **결정론적 린터 우선**: AGENTS.md가 토큰 린트 명령(예: stylelint `declaration-strict-value`, 토큰용 커스텀 ESLint)을 선언하면 **그것을 먼저 실행**해 위반을 수집한다(= blocking). 미설정이면 "토큰 린터 미설정 — 권장: stylelint-declaration-strict-value" 를 남긴다.
2. **에이전트 휴리스틱(보완)**: 스펙 파일을 읽어 허용 토큰을 파악하고, 린터가 못 잡는 영역만 점검(= advisory) — 허용목록 밖 raw hex/rgb, 스펙 외 굵기·그림자·그라디언트, legacy 클래스 잔재.
   - **오탐 가드**: 주석·문자열 리터럴·문서/예시·테스트 픽스처·vendor 파일의 hex는 위반으로 보지 말 것. 실제 적용되는 스타일 선언만.
   - **grep 한계 명시**: '의미가 틀린 토큰(예: 위험색을 성공 버튼에)'·'base/primitive를 컴포넌트가 직접 참조(semantic 우회)'는 정적으로 못 잡음 → "비주얼/디자인 리뷰 필요"로 표기, 단정하지 말 것.

결과: 위반 없으면 "✅ 토큰 준수", 있으면 파일:라인:내용 (린터=blocking / 휴리스틱=advisory 구분).

## Agent B — 접근성 WCAG 2.2 AA (`subagent_type: Explore`, `model: haiku`, `run_in_background: true`)

1. **a11y 도구 우선**: AGENTS.md가 a11y 도구(axe-core/Playwright, jest-axe, lighthouse, eslint-plugin-jsx-a11y)를 선언하면 그것을 실행해 렌더 DOM 기준 결과를 집계. 미선언 → 아래 정적 점검 폴백 + disclaimer.
2. **정적 점검** (파일:라인·권고):
   - **시맨틱 우선**: 네이티브 HTML로 가능하면 ARIA를 쓰지 않는다(`No ARIA is better than bad ARIA`). 인터랙티브 요소는 네이티브 텍스트 우선, `aria-label`은 차선.
   - 인터랙티브(button/a)에 접근가능 이름 / 이미지 alt / 폼 입력에 연결된 label / 다이얼로그 role에 이름
   - **ARIA 오용**: `<div>`/`<span>`에 `role=button` 등(네이티브 미사용 의심), 텍스트 있는데 중복 `aria-label`, 잘못된/중복 role, `aria-*` 오타
   - 색상 단독 정보 전달(아이콘·텍스트 병행 여부), 비정상 `tabindex`
   - heading 구조(단일 h1·레벨 건너뛰기)·landmark 존재 — 구조 신호일 뿐 의미 정확성은 수동
   - **오탐 가드**: 동적/조건부 주입(변수 prop·보간) alt·label·aria는 '판정불가(needs-review)'로 분류, 단정 금지. 결과를 **위반 / 판정불가** 두 버킷으로.

결과 — 통과 시: **"✅ 정적 점검 통과 — 단, 색상 대비(1.4.3)·키보드 조작(2.1.1)·포커스 순서/가시(2.4.3/2.4.7)·키보드 트랩(2.1.2)·reflow(1.4.10)는 정적으로 미검증(런타임/수동 필요)"** 를 항상 함께 출력(false pass 방지).

## Agent C — 한국어 UX 적합성 (`subagent_type: Explore`, `model: haiku`, `run_in_background: true`)

**프론트엔드가 있고 한국어 UI인 repo만 실행** (영어 UI·비해당 → "한국어 UI 아님 — 스킵"). 단일 출처: `docs/korean-ux.md`·`.claude/rules/korean-ux.md`(있으면).
**advisory만 — 머지 차단 아님.** 정적 텍스트(JSX/Vue 문자열 리터럴·상수·i18n 키값)만 점검, 동적 서버 응답·번역 파일 내용은 범위 밖.

점검(발견 시 목록 제시):
1. **영어 직역 버튼/라벨**: `Save`·`Cancel`·`Delete`·`Submit`·`Confirm`·`Search`·`Login`·`Logout`·`Register`가 한국어 없이 단독 사용 → "저장/취소/삭제/제출/확인/검색/로그인/로그아웃/회원가입" 권장
2. **직역 용어**: "쇼핑 카트"·"내 페이지"·"유저네임"·"패스워드"·"사인인"·"프라이버시 정책"·"서비스 약관" 등 → korean-ux.md 정착어와 대조
3. **날짜 포맷**: UI 문자열에 `MM/DD/YYYY`·`YYYY-MM-DD` 표시 → `YYYY.MM.DD` 권장
4. **통화**: 금액 컴포넌트에 `$`·`USD` 노출 → 원화(`원`/`₩`) 권장
5. **합쇼체 직역 에러**: "~입니다/~하시겠습니까?"가 토스트·에러에 반복 → 해요체 권장

오탐 가드: 주석·import 경로·변수명·API 키값·타입 정의 제외. **정착 외래어(로그인·대시보드·필터·알림)는 위반 아님.** 결과는 advisory.

---

## 집계 (에이전트 완료 후)

| 항목 | 결과 | 비고 |
|---|---|---|
| 디자인 토큰 준수 | ✅/⚠️/스킵 | 린터 위반=머지 차단 권고 / 휴리스틱=참고 |
| WCAG 2.2 AA (정적·도구) | ✅/⚠️ | 정적 미검증 항목 disclaimer 포함 |
| 한국어 UX 적합성 | ✅/⚠️/스킵 | **advisory** — 직역체·포맷 불일치 목록(머지 차단 아님) |

린터 위반이 있으면 "QA 통과"를 출력하지 않는다. 위반은 파일 경로·수정 방향과 함께 제시.
(참고: 토큰 준수·정적 a11y 통과가 시각적 정확성을 보장하지 않는다 — 비주얼 회귀는 별개 레이어.)
