# CLAUDE.md — hosthelper 저장소 컨벤션

> 본 파일은 Claude Code / Anthropic SDK 작업 시 적용되는 규칙입니다.

## 1. 도메인 한 줄

수익형 숙박(에어비앤비/STR) 호스트 ↔ 청소 매니저 양면 마켓플레이스 SaaS. 한국, 서울 파일럿. 수수료 정액 ₩10,000/건. 운영 주체 호스트헬퍼(729-33-00827).

## 2. 모노레포 구조

```
apps/       web (Next.js) · admin · api (NestJS) · worker (BullMQ)
packages/   shared (zod) · db (Prisma) · ui (디자인 시스템) · ai (Claude 게이트웨이)
infra/      terraform
docs/       PRD, ADR, M_AND_A_READINESS, ARCHITECTURE, BUSINESS_ENTITY
```

각 패키지는 **분리 매각 가능**하도록 결합도를 최소화합니다 (M&A 친화).

## 3. AI / LLM 작업 규칙

### 항상 `@hosthelper/ai` 통과
- API 모듈에서 직접 `@anthropic-ai/sdk`를 호출하지 않습니다.
- 새 LLM 기능은 `packages/ai/src/<purpose>.ts`에 순수 함수로 작성하고, API 모듈은 그 래퍼만 호출합니다.

### 모델
- 기본: `claude-opus-4-7` (env: `HOSTHELPER_AI_MODEL`로 오버라이드).
- 사용자가 명시적으로 다른 모델을 요청하지 않는 한 변경 금지.
- 모델 ID는 `claude-api` 스킬의 `shared/models.md`에서 검증.

### 필수 패턴
1. **Prompt Caching**: 시스템 프롬프트에 `cache_control: { type: "ephemeral" }` 적용. 시스템 프롬프트는 안정적(불변)이어야 함 — 타임스탬프·UUID 금지.
2. **Adaptive Thinking**: 비자명한 추론은 `thinking: { type: "adaptive" }`. Opus 4.7은 `budget_tokens` 미사용.
3. **구조화된 출력**: zod 스키마로 검증. 파싱 실패 시 명시적 예외.
4. **토큰 회계**: 모든 호출 결과를 `LLMCall` 테이블에 기록. `Decision` 테이블과 연결.
5. **예산 가드레일**: `TokenBudget` 인스턴스로 호출 전 `check()`, 호출 후 `record()`.
6. **결정 영속화**: 운영적으로 중요한 모든 의사결정은 `Decision` 테이블에 남깁니다 (Queryable Organization).

### 금지 사항
- 시스템 프롬프트에 `Date.now()`, `process.env.HOSTNAME`, 세션 ID 인터폴레이션 금지 (캐시 파괴).
- 비밀(API 키, 사업자등록번호 부분)을 프롬프트에 포함 금지.
- `temperature`, `top_p`, `top_k` Opus 4.7에서 사용 금지 (400 에러).
- OpenAI-호환 어댑터 또는 다른 LLM 프로바이더 추가 금지 — 본 저장소는 Anthropic 전용.

## 4. 코드 컨벤션

- TypeScript strict, ESM 또는 CommonJS는 패키지별로 통일.
- 의도하지 않은 한 외부 API는 zod로 입력 검증 (라우트별 `ZodPipe`).
- Prisma 모델 변경 시: `pnpm db:migrate --name <설명>` 후 마이그레이션 디렉토리 커밋.
- 의존성 추가는 워크스페이스 명시: `pnpm --filter @hosthelper/<pkg> add <dep>`.

## 5. 테스트

- 단위: Jest. 순수 함수(매칭 점수, 가격 계산, 토큰 비용)는 100% 커버.
- 통합: API smoke test (CI에서 자동).
- LLM 호출이 포함된 테스트는 절대 실 API에 의존하지 않습니다 — 모킹 또는 결정론적 폴백.

## 6. M&A 친화 유지

- 새 패키지를 추가할 때 `packages/<name>/README.md`에 분리 매각 가치를 한 줄로 명시.
- `docs/ARCHITECTURE.md §3` 분리 매각표를 갱신.
- 라이선스: 모든 새 의존성은 MIT/Apache-2.0 호환만 (`docs/THIRD_PARTY_LICENSES.md`).

## 7. 한국어

- 운영·사업·UI 텍스트는 한국어 우선.
- 코드 식별자(변수·함수·타입)는 영어. 주석은 한국어 또는 영어 자유.
- 커밋 메시지 제목은 한·영 혼용 가능, 본문은 한국어 권장.
