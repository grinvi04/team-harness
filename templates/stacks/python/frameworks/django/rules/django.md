---
paths: ["**/*.py", "**/templates/**/*.html"]
---

# Django 작업 규칙

python.md와 함께 선택한 Django 프로젝트에만 적용한다. templates·htmx·API 중 실제 화면 방식을 확인한다.

## 공식 기준

[Django5.2 보안](https://docs.djangoproject.com/en/5.2/topics/security/),
[조회 최적화](https://docs.djangoproject.com/en/5.2/topics/db/optimization/),
[트랜잭션](https://docs.djangoproject.com/en/5.2/topics/db/transactions/)을 설치한 Django 문서 버전과 대조한다.

## 조건부 실무 판단

- 화면 출력은 자동 escaping을 유지한다. safe/mark_safe·raw HTML은 신뢰·검증 경계가 필요하다.
  정제가 비용이다. 텍스트 출력이 단순 대안이며 악성 HTML·속성 입력과 출력 문맥을 검사한다.
- 세션을 쓰는 변경 요청과 HTMX 부분 요청도 CSRF·서버 권한을 확인한다. DRF·django-htmx는 필수가 아니다.
  별도 인증 체계의 비용을 비교하고 익명·다른 사용자·CSRF 누락·검증 실패 요청을 시험한다.
- 읽기 쿼리가 반복되는 실제 목록에서만 select_related/prefetch_related를 선택한다.
  더 많은 메모리·join 비용이 생긴다. 필드 축소·페이지 제한이 대안이며 쿼리 수와 데이터 증가를 측정한다.
- 여러 쓰기의 일관성이 필요할 때 짧은 트랜잭션과 업무 함수를 둔다. 서비스 계층을 모든 CRUD에 강제하지 않는다.
  추상화·잠금 비용이 생긴다. 모델/폼의 단순 처리가 대안이며 롤백·동시 수정·중복 요청을 검사한다.

manage.py check와 실제 Django 테스트를 연결한다. HTMX 브라우저 버전은 gem/Python helper 버전으로 추정하지 않는다.
