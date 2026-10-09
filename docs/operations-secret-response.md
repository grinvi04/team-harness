# 시크릿 유출 대응 런북

[상위 문서](operations.md)로 돌아간다. 아래는 원문의 해당 주제 본문을 순서대로 보존한 실행 계약이다. 상위 문서와 함께 적용한다.

### 시크릿 유출 대응 런북

> **감지·차단은 이미 계층으로 존재**한다 — GitHub Secret Scanning·Push Protection, gitleaks(CI
> `ci-gate.yml` secret-scan 잡), guard 명령 마스킹·PreToolUse 유출 탐지 프롬프트·release 전
> `security-reviewer`·`.gitignore`(.env/*.key/*.pem). 저장 표준은 `auth-standards.md`(AWS Secrets
> Manager/SSM — 코드·.env 금지)다. 이 런북은 그 계층이 **뚫린 뒤의 대응**만 다룬다(중복 서술 안 함 — 참조).
> 시크릿 유출은 **SEV1(데이터 유출)로 선언**하고 §1 대응 절차(IC/조치자 분리)를 따르되, 아래 시크릿 특유
> 단계를 얹는다.

각 계층의 역할은 다음과 같다.

- **GitHub Push Protection** — GitHub가 지원하는 시크릿 패턴을 서버에서 push 시점에 검사해 저장소 유입 전에
  차단한다. 지원 패턴 밖 값과 명시적 우회 가능성 때문에 단독 안전망으로 간주하지 않는다.
- **GitHub Secret Scanning** — 저장소의 모든 브랜치와 전체 Git 히스토리를 계속 검사하고 이미 유입된 시크릿을
  경보로 남긴다. 사후 탐지이므로 유효한 값은 경보 확인 즉시 폐기·회전한다.
- **gitleaks required `secret-scan`** — PR 커밋 범위를 별도 탐지 엔진으로 재검증해 머지를 차단한다. 최초
  push 뒤 실행되는 CI이므로 Push Protection을 대체하지 않으며, GitHub 지원 패턴과 다른 규칙·entropy 탐지로
  상호 보완한다. 모든 브랜치·전체 Git 히스토리의 지속 검사는 GitHub Secret Scanning이 맡는다.

**핵심 원칙 — 폐기가 히스토리 정리보다 우선.** 시크릿은 커밋된 순간 이미 공개다(clone·fork·CI 로그·캐시로
확산 — 되돌릴 수 없음). 그래서 **값을 죽이는 폐기가 1순위**, 히스토리 purge는 2차다(비가역성 원칙: 못 되돌릴
확산을 전제로 손실을 줄인다).

1. **폐기·회전 (즉시, 1순위)** — 유출된 크레덴셜을 **무효화**한다. 무엇을 지웠는지가 아니라 그 값이 아직
   유효한지가 위험의 크기다.
   - GitHub 토큰/PAT → 즉시 revoke (Settings→Developer settings / org 감사 로그로 사용 흔적 확인)
   - AWS 키 → IAM에서 비활성화 후 삭제, Secrets Manager 값은 rotate
   - DB 비밀번호·커넥션 문자열 → 회전 + 노출 계정 권한 축소
   - 서드파티 API 키 → 발급처 콘솔에서 폐기·재발급
   - 회전한 새 값의 저장 위치 = `auth-standards.md`(Secrets Manager/SSM — 코드·.env 재유입 금지)
2. **영향 범위 산정** — 무엇이·언제부터·어디까지 노출됐나:
   - gitleaks 리포트(`ci-gate.yml`)와 `git log -p`로 노출 커밋·기간을 특정
   - **public repo였나**(fork·clone·검색 인덱싱 가능성 ↑) vs private였나
   - 그 크레덴셜로 접근 가능한 자원(DB·버킷·결제)의 **실제 접근 로그**를 확인 — 오남용이 이미 일어났는지
3. **히스토리 purge (2차 — 폐기 이후에만)**:
   - `git filter-repo`(권장) 또는 BFG로 해당 파일·문자열 제거 후 force-push
   - ⚠️ **이미 clone/fork/캐시된 사본은 못 지운다** — purge는 노출 축소일 뿐 **폐기를 대체하지 않는다**.
     public이었으면 GitHub 지원에 캐시 무효화를 요청한다
   - main/develop force-push는 별도 소유자 승인과 보호 변경·복원 절차가 필요하다.
     `solo-merge`는 리뷰 승인 요건만 다루며 force-push를 허용하지 않는다.
4. **통지** — SEV1 선언 후:
   - `#incident` 스레드 + 리드 호출(§1의 IC/조치자 분리 적용 — 조치자가 폐기, IC가 전파)
   - 크레덴셜 소유 서드파티·영향받는 팀에 통지. 개인정보가 연루되면 고지 의무(법적 요건)를 확인
5. **포스트모템 (SEV1 필수, blameless)** — §1 포스트모템 템플릿 + 시크릿 특유 질문:
   - **왜 감지·차단 계층이 못 막았나** — gitleaks가 놓친 패턴? 로컬 커밋이 훅을 우회? `.gitignore` 누락?
     PreToolUse 프롬프트 사각? (사람 탓 아니라 계층의 구멍으로 기술)
   - 재발 방지 = 그 계층 강화(gitleaks 룰·`.gitignore` 패턴·guard 마스킹)로 GitHub 이슈화 + 담당 + 기한
