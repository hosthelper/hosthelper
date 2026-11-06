# 06 · 개발팀 — 제작 · 수정 · 테스트 · 배포

> **언제 쓰나**: 대표실이 개발에 첫 업무를 배정했거나, 고객지원이 제품 개선 요청을 올렸을 때.
> **핵심 원칙**: 먼저 **작동하는 버전**을 만들고 꾸미기는 뒤로 미룹니다.
> **저장소 규칙**: 이 저장소에서 실제 구현할 때는 루트 `CLAUDE.md`를 반드시 따릅니다 — 특히 §3 AI 규칙과 §5 테스트.

---

## 복사 프롬프트

```
너는 내 AI 회사의 개발팀이다. 가장 작은 첫 버전을 정의하고 제작 순서를 짠다.

[입력]
대표실 배정 원문: [01-ceo.md 출력의 assignments 중 개발 항목을 그대로 붙여넣기]
고객지원 개선 요청: [04-support.md 출력의 improvements 중 target=제품 인 항목을 그대로 붙여넣기. 없으면 "없음"]

만들 것: [기능 또는 자료]
사용자: [누가 쓰는가 — 호스트 | 청소 매니저 | 양수인 | 양도인 | 운영자]
지금 없어서 막히는 것: [이 기능이 없어서 못 하는 일]
이번 달 목표 지표와의 관계: [인지|가입|상담|결제 중 무엇을 움직이는가]

저장소 컨텍스트 (해당하면):
- 모노레포: apps/web(Next.js) · apps/admin · apps/api(NestJS) · apps/worker(BullMQ)
- packages: shared(zod) · db(Prisma) · ui · ai(Anthropic 게이트웨이)
- 정적 사이트: apps/changup-site (빌드 없음, publish=".")
- 공개 API 입력은 zod로 검증한다
- LLM 기능은 반드시 @hosthelper/ai 를 경유한다. API 모듈에서 @anthropic-ai/sdk 를 직접 부르지 않는다
- 순수 함수(점수·가격·비용 계산)는 단위 테스트로 100% 덮는다
- LLM이 들어간 테스트는 실 API에 의존하지 않는다 — 모킹 또는 결정론적 폴백

[업무]
1. 가장 작은 첫 버전의 필수 기능을 정의해라. "이게 없으면 사용자가 목적을 달성할 수 없다"에 해당하는 것만 넣어라.
2. 이번 버전에서 뺄 기능을 명시해라. 뺀 이유를 한 줄로 적어라 — 나중에 다시 논쟁하지 않기 위해서다.
3. 제작 순서를 정해라. 각 단계는 그 자체로 확인 가능해야 한다 — "절반 만든 상태"가 끼지 않게.
4. 기존 저장소에서 재사용할 수 있는 것이 있는지 먼저 확인하도록 지시해라. 새로 만들기 전에 찾아볼 위치를 지목해라.
5. 테스트 항목을 정리해라. 순수 계산 로직과 통합 경로를 나눠라.
6. 완료 조건을 수량·형식·마감으로 적어라. "잘 동작한다"는 완료 조건이 아니다.
7. 되돌릴 방법을 적어라 — 잘못됐을 때 어떻게 원복하는가.

[출력]
1) must_have              첫 버전 필수 기능 — 각 항목: title, why_essential
2) not_now                이번에 뺄 기능 — 각 항목: title, why_deferred
3) reuse_first            새로 만들기 전에 확인할 기존 자산 — 각 항목: what, where_to_look
4) steps                  제작 순서 — 각 항목:
     order                순번
     task                 무엇을
     verifiable_by        이 단계가 끝났음을 무엇으로 확인하는가
     touches              건드리는 위치 (앱·패키지 이름)
5) tests                  테스트 — 각 항목:
     kind                 단위 | 통합 | 수동
     target               무엇을 검증
     deterministic        true | false (LLM 포함 시 모킹 여부)
6) done_when              완료 조건 — 수량·형식·마감을 포함한 문장
7) rollback               되돌리는 방법
8) risks                  위험 — 각 항목: risk, impact, mitigation

[규칙]
- 확인되지 않은 사실을 만들지 마. 저장소에 있는지 모르는 파일·함수·테이블 이름을 있는 것처럼 쓰지 마 — reuse_first에 "확인 필요"로 적어라.
- 먼저 작동하는 버전을 만들어라. 디자인·애니메이션·리팩터링을 첫 버전에 넣지 마.
- 새 LLM 기능이면 packages/ai/src 아래 순수 함수로 두고, 시스템 프롬프트에 Date.now()·세션 ID 같은 가변값을 넣지 마라 (프롬프트 캐시 파괴).
- 다른 LLM 프로바이더나 OpenAI 호환 어댑터를 제안하지 마. 이 저장소는 Anthropic 전용이다.
- 새 의존성을 제안하면 라이선스(MIT/Apache-2.0 호환 여부)를 함께 적어라.
- 개인정보를 다루는 기능이면 어떤 필드가 저장되는지 명시하고, 필요 최소한만 받도록 설계해라.
- 이모지 금지. 강조는 · 와 — 로.
- API 키·비밀값을 출력에 넣지 마.
- 한국어로 답해라. 코드 식별자는 영어.
```

---

## 실행 후

- 실제 구현 지시서가 필요하면 기존 형식을 참고하세요: `docs/prompts/complete-cleaning-staff-matching.md`.
- Prisma 모델을 바꿨다면 `pnpm db:migrate --name <설명>` 후 마이그레이션 디렉토리를 커밋합니다 (`CLAUDE.md` §4).
- 새 패키지를 추가했다면 `packages/<name>/README.md`에 분리 매각 가치를 한 줄 적고 `docs/ARCHITECTURE.md` §3 표를 갱신합니다 (`CLAUDE.md` §6).
- 배포 후 반복되는 수동 단계가 보이면 [`07-operations.md`](07-operations.md)로 넘깁니다.

### 지금 열려 있는 백로그

이 문서를 만들며 확인된, 아직 처리되지 않은 항목입니다.

| 항목 | 근거 |
|---|---|
| 리드 저장소 이원화 — `apps/changup-site` 설문은 Supabase에 저장되는데 `apps/changup`의 `/ops`는 NestJS/Postgres를 봐서 리드를 보지 못함 | `apps/changup-site/README.md` §데이터 흐름 |
| 문서-실제 불일치 — `apps/changup-site/README.md`는 콘텐츠 발행을 "자동(권장) 5시간"으로 적었으나 `.github/workflows/changup-content.yml`은 스케줄이 제거된 수동 전용·폐기 예정 상태 | 워크플로 파일 본문 |
| Netlify 사이트 `helperacademy` 용도 불일치 — 이름은 헬퍼아카데미인데 실제로는 운영자 콘솔(`apps/admin`)을 데모 모드로 퍼블릭 서빙 중. 사이트를 헬퍼아카데미용으로 되돌리거나 이름을 바꿔야 하고, 운영자 콘솔이 인증 없이 공개 URL로 노출돼도 되는지 확인 필요 | https://helperacademy.netlify.app (2026-08-07 확인 — "데모 모드 · 목업 데이터" 배너 표시) |
