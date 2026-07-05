#!/usr/bin/env python3
"""PreToolUse hook (matcher: Agent): 서브에이전트 스폰 시 subagent_type별로 model을 강제 주입한다.

티어링을 prose가 아닌 게이트로 만드는 단일 진실원천 — 정책 표는 docs/model-tiering.md.
- 고볼륨 상속 타입만 다운그레이드(메인 Opus 상속 비용 차단).
- 명시 티어(security-reviewer/Plan/verifier 등)는 TIER에 없어 손대지 않음 → opus 유지.
- 결정을 ~/.claude/hooks/subagent-model.log 에 남겨 세션·repo별 실측 감사(예: `grep 'cwd=.*/erp'`).

의도적 하드포스(타입=티어): 넘긴 model이 있어도 TIER 타입이면 무조건 강제한다.
  → "파일수정+opus"가 필요하면 위임이 아니라 **메인(opus) 인라인** 또는 **Workflow**(stage별 모델 지정,
    이 훅 비경유)로 한다. opt-in 탈출구를 만들지 않는 이유: LLM 오케스트레이터가 그 구멍으로
    비용을 부풀릴 수 있어 결정론적 게이트가 약해진다. (2026-07 결정)
"""
import sys, json, os, datetime

# subagent_type -> 강제 model. 여기 없는 타입은 손대지 않는다(frontmatter/inherit 존중).
TIER = {
    "Explore": "haiku",          # 검색·grep·읽기전용 조회
    "general-purpose": "sonnet", # 일반 빌드·구현
    "claude": "sonnet",          # 기본 범용 캐치올
}

LOG = os.path.expanduser("~/.claude/hooks/subagent-model.log")


def log(msg):
    try:
        os.makedirs(os.path.dirname(LOG), exist_ok=True)  # 새 머신에서도 로그 디렉터리 보장
        with open(LOG, "a") as f:
            f.write(f"{datetime.datetime.now().astimezone().isoformat()} {msg}\n")
    except Exception:
        pass


def main():
    try:
        data = json.load(sys.stdin)
    except Exception as e:
        log(f"parse-error {e}")
        return  # 입력 파싱 실패 시 아무것도 안 함(스폰 정상 진행 — 비용 fail-open)

    if data.get("tool_name") != "Agent":
        return

    sid = data.get("session_id") or "?"
    cwd = data.get("cwd") or "?"
    meta = f"session={sid} cwd={cwd}"

    tool_input = data.get("tool_input") or {}
    stype = tool_input.get("subagent_type")
    passed = tool_input.get("model")            # orchestrator가 넘긴 model(보통 None)
    forced = TIER.get(stype)

    if not forced:
        actual = passed if passed else "inherit(main)"
        log(f"{meta} skip type={stype!r} model={actual}")
        return  # 명시 티어/미지정 타입은 그대로 둔다

    if passed == forced:
        # 이미 목표 티어면 no-op — updatedInput 방출 없이 로그만(노이즈·불필요 재작성 방지)
        log(f"{meta} noop type={stype!r} model={forced}")
        return

    new_input = dict(tool_input)
    new_input["model"] = forced

    out = {
        "hookSpecificOutput": {
            "hookEventName": "PreToolUse",
            "updatedInput": new_input,
        }
    }
    prev = passed if passed else "inherit(main)"
    log(f"{meta} force type={stype!r} model={prev}->{forced}")
    print(json.dumps(out))


if __name__ == "__main__":
    main()
