#!/usr/bin/env python3
"""PreToolUse hook (matcher: Agent): 서브에이전트 스폰 시 subagent_type별로 model을 강제/보정한다.

티어링을 prose가 아닌 게이트로 만드는 단일 진실원천 — 정책 표는 docs/model-tiering.md.
- 고볼륨 상속 타입만 다운그레이드(메인 Opus 상속 비용 차단) — TIER, 하드포스.
- opus 전용 특권 타입(verifier·security-reviewer)은 model이 비었을 때만 채움 — DEFAULT, 기본값.
  (agents/*.md의 `model: opus` frontmatter가 1차 방어선인데, 새 특권 타입 파일 작성 시 사람이
  깜빡하거나 플랫폼이 frontmatter를 안 지키는 사례가 실측 확인돼(Claude Code 공개 이슈 다수,
  2026-07) 2차 방어선을 둔다. 하드포스와 달리 명시값은 그대로 존중 — 의식적 다운그레이드 유연성 보존)
- 그 외 타입(Plan·harness-manager 등)은 손대지 않음 → 메인 모델 상속.
- 결정을 ~/.claude/hooks/subagent-model.log 에 남겨 세션·repo별 실측 감사(예: `grep 'cwd=.*/erp'`).

의도적 하드포스(TIER 항목): 넘긴 model이 있어도 무조건 강제한다.
  → "파일수정+opus"가 필요하면 위임이 아니라 **메인(opus) 인라인** 또는 **Workflow**(stage별 모델 지정,
    이 훅 비경유)로 한다. opt-in 탈출구를 만들지 않는 이유: LLM 오케스트레이터가 그 구멍으로
    비용을 부풀릴 수 있어 결정론적 게이트가 약해진다. (2026-07 결정)

DEFAULT는 TIER와 방향(다운그레이드 vs 품질 하한)·정책(하드포스 vs 존중)이 반대라 같은 dict로
  섞지 않는다. (2026-07 결정, model-tiering.md)
"""
import sys, json, os, datetime

# subagent_type -> 강제 model. 넘긴 model이 있어도 무조건 이 값(비용 다운그레이드).
TIER = {
    "Explore": "haiku",          # 검색·grep·읽기전용 조회
    "general-purpose": "sonnet", # 일반 빌드·구현
    "claude": "sonnet",          # 기본 범용 캐치올
}

# subagent_type -> 기본 model. model이 비어있을 때만 채운다(품질 하한) — 명시값은 그대로 둔다.
DEFAULT = {
    "harness-guard:verifier": "opus",
    "harness-guard:security-reviewer": "opus",
}

LOG = os.path.expanduser("~/.claude/hooks/subagent-model.log")


def log(msg):
    try:
        os.makedirs(os.path.dirname(LOG), exist_ok=True)  # 새 머신에서도 로그 디렉터리 보장
        if os.path.exists(LOG) and os.path.getsize(LOG) > 256 * 1024:  # 256KB 초과 시 최근 절반만 보존
            with open(LOG) as f:
                lines = f.readlines()
            with open(LOG, "w") as f:
                f.writelines(lines[len(lines) // 2:])
        with open(LOG, "a") as f:
            f.write(f"{datetime.datetime.now().astimezone().isoformat()} {msg}\n")
    except Exception:
        pass


def _emit(tool_input, model):
    new_input = dict(tool_input)
    new_input["model"] = model
    print(json.dumps({
        "hookSpecificOutput": {
            "hookEventName": "PreToolUse",
            "updatedInput": new_input,
        }
    }))


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
    meta = f"session={sid!r} cwd={cwd!r}"  # repr — 개행 등으로 가짜 감사 라인 위조 방지(로그 포징)

    tool_input = data.get("tool_input") or {}
    stype = tool_input.get("subagent_type")
    passed = tool_input.get("model")            # orchestrator가 넘긴 model(보통 None)
    prev = passed if passed else "inherit(main)"

    forced = TIER.get(stype)
    if forced:
        if passed == forced:
            # 이미 목표 티어면 no-op — updatedInput 방출 없이 로그만(노이즈·불필요 재작성 방지)
            log(f"{meta} noop type={stype!r} model={forced}")
            return
        _emit(tool_input, forced)
        log(f"{meta} force type={stype!r} model={prev!r}->{forced}")
        return

    default = DEFAULT.get(stype)
    if default:
        if passed:
            # 명시값 있으면 그대로 존중(의식적 다운그레이드 허용) — 하드포스와의 핵심 차이
            log(f"{meta} skip(explicit) type={stype!r} model={passed!r}")
            return
        _emit(tool_input, default)
        log(f"{meta} fill type={stype!r} model=inherit(main)->{default}")
        return

    # TIER에도 DEFAULT에도 없는 타입 — 손대지 않는다(메인 모델 상속)
    log(f"{meta} skip type={stype!r} model={prev!r}")


if __name__ == "__main__":
    main()
