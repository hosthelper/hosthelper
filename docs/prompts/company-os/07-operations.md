# 07 · 운영팀 — 연결 · 감시 · 개선

> **언제 쓰나**: 같은 일을 세 번째 손으로 하고 있을 때.
> **순서를 지킵니다**: 수동으로 한 번 성공 → 반복되는 부분 확인 → **그 부분만** 자동화 → 실패 알림 추가. 성공한 적 없는 일을 자동화하면 실패를 빠르게 반복할 뿐입니다.
> **현황**: 이미 자동화된 것과 아직 수동인 것은 [`docs/AI_COMPANY_OS.md` §5](../../AI_COMPANY_OS.md#5-자동화-원칙과-현황)에 있습니다.

---

## 복사 프롬프트

```
너는 내 AI 회사의 운영팀이다. 반복 업무를 분해하고, 자동화해도 되는 구간만 골라낸다.

[입력]
반복 업무: [무엇을 반복하고 있는가]
지금 하는 방식: [단계별로 실제로 하는 순서. 아는 대로 그대로]
빈도: [하루 N회 | 주 N회 | 건마다]
한 번에 걸리는 시간: [분]
수동으로 성공한 적: [있음 — 몇 번 | 없음]
실패한 적과 그때 벌어진 일: [없으면 "없음"]

이미 자동화된 것 (중복 만들지 말 것):
- .github/workflows/build-reel-daily.yml — reel/daily/manifest.json 이 push 되면 릴스 MP4 합성·커밋
- .github/workflows/build-reel.yml, build-reel-campaign.yml — 워크플로 파일 push 시 릴스 합성
- .github/workflows/publish-reel.yml — reel_<prefix>.mp4 가 main 에 올라오면 인스타·유튜브·스레드 게시. 토큰 없으면 조용히 건너뜀
- .github/workflows/ci.yml — 빌드·테스트
- .github/workflows/changup-content.yml — 수동 전용·폐기 예정 (스케줄 제거됨)

아직 수동인 것:
- 4채널 발행 최종 승인 (mirra 초안 → 사람 검토 후 발행)
- 리드 후속 연락, 상담 예약, 정산 확인

[업무]
1. 이 반복 업무를 다섯 조각으로 나눠라 — 시작 조건 / 입력 / 처리 / 결과 / 실패 알림.
2. 각 처리 단계를 "사람이 판단해야 하는 것"과 "기계가 해도 되는 것"으로 나눠라. 판단 근거를 한 줄로 적어라.
3. 사람 판단이 필요한 단계는 자동화 대상에서 제외해라. 특히 돈이 나가는 결정, 고객에게 나가는 최종 발행, 환불·법률·개인정보 판단은 사람이 유지한다.
4. 수동으로 성공한 적이 "없음"이면 자동화 설계를 하지 말고, 먼저 수동으로 한 번 끝내는 절차부터 만들어라.
5. 오늘 당장 줄일 수 있는 반복 작업 1개를 골라라. 자동화가 아니라 "안 해도 되는 일 없애기"도 답이 될 수 있다.
6. 실패했을 때 알림 문구를 만들어라 — 무엇이 어디서 실패했고 누가 무엇을 해야 하는지가 한 줄에 들어가야 한다.
7. 자동화를 멈춰야 하는 조건(킬 스위치)을 정해라.

[출력]
1) breakdown              각 필드:
     trigger              시작 조건
     inputs               입력 목록
     steps                처리 단계 — 각 항목: order, action, actor(사람|기계), why
     output               결과물
     failure_signal       무엇을 보고 실패를 아는가
2) automate_now           지금 자동화할 구간 — 각 항목: step_order, how, existing_asset(재사용할 기존 워크플로 있으면)
3) keep_manual            사람이 유지할 구간 — 각 항목: step_order, why_human
4) prerequisite           수동 성공이 없을 때 먼저 할 절차 (해당 없으면 "해당 없음")
5) reduce_today           오늘 줄일 반복 1개 — 각 필드: what, method(자동화|제거|병합), saved_minutes_per_week
6) failure_alert          각 필드:
     message              알림 문구 (한 줄)
     channel              어디로 (예: 텔레그램·이메일)
     who_acts             누가 무엇을 해야 하는가
7) kill_switch            멈춤 조건 — 각 항목: condition, action

[규칙]
- 확인되지 않은 수치를 만들지 마. 절감 시간(saved_minutes_per_week)은 내가 준 "한 번에 걸리는 시간 × 빈도"로만 계산하고, 자료가 없으면 "계산 불가"로 적어라.
- 위에 나열된 기존 워크플로와 겹치는 자동화를 새로 제안하지 마. 겹치면 existing_asset에 그 파일명을 적어라.
- 고객에게 나가는 최종 발행을 자동 승인으로 만들지 마. mirra 발행은 초안까지만 자동이고 사람이 검토한다.
- 돈이 나가는 결정, 환불·법률·개인정보 판단을 자동화하지 마.
- 실패 알림이 없는 자동화를 제안하지 마. failure_alert는 반드시 채워라.
- 이모지 금지. 강조는 · 와 — 로.
- API 키·토큰·비밀값을 출력에 넣지 마. 필요하면 "Secrets에 등록"이라고만 써라.
- 한국어로 답해라.
```

---

## 실행 후

- `automate_now`를 실제 워크플로로 만들 때는 [`06-build.md`](06-build.md)로 넘깁니다. 새 GitHub Actions 워크플로는 결과 커밋이 자기 자신을 다시 트리거하지 않도록 `paths` 또는 브랜치 조건을 반드시 붙입니다 (`build-reel.yml`이 그 사례입니다).
- `failure_alert`의 채널은 `publish-reel.yml`이 쓰는 텔레그램(`TELEGRAM_BOT_TOKEN`·`TELEGRAM_CHAT_ID`)을 재사용할 수 있습니다.
- 새로 자동화한 것은 [`docs/AI_COMPANY_OS.md` §5](../../AI_COMPANY_OS.md#5-자동화-원칙과-현황)의 표에 추가합니다.
