# @hosthelper/ai

> hosthelper AI 게이트웨이. Anthropic Claude SDK 래퍼, 토큰 예산 가드레일, 분쟁 1차 판정.

**M&A 친화**: 본 패키지는 hosthelper 코어 도메인과 독립적으로 동작합니다. STR(단기임대) 도메인 의존성을 최소화했습니다.

## 설치

```bash
pnpm add @hosthelper/ai
```

환경변수:
- `ANTHROPIC_API_KEY` (필수)
- `HOSTHELPER_AI_MODEL` (선택, 기본 `claude-opus-4-7`)
- `HOSTHELPER_AI_DAILY_BUDGET_USD` (선택, 기본 호출 측에서 결정)

## 사용

```ts
import { createAiClient, analyzeDispute, TokenBudget } from '@hosthelper/ai';
import IORedis from 'ioredis';

const ai = createAiClient();
const budget = new TokenBudget(new IORedis(process.env.REDIS_URL!), 50); // $50/일

const { allowed } = await budget.check();
if (!allowed) throw new Error('일일 AI 예산 초과');

const result = await analyzeDispute(ai, {
  jobId: 'job-1',
  property: { nickname: '청담 스카이뷰', pyeong: 22, bedrooms: 2, district: '강남구' },
  booking: { cleaningStartAt: '2026-06-01T11:00:00Z', cleaningEndAt: '2026-06-01T14:00:00Z', quotedPrice: 130000 },
  cleaner: { name: '박매니저', rating: 4.8, completedJobs: 30 },
  checklist: [{ area: '거실', title: '바닥 청소', checked: true, photoCount: 2 }],
  hostStatement: '거실에 머리카락이 많이 떨어져 있었습니다.',
  cleanerStatement: '청소 후 사진을 모두 첨부했고 깨끗했습니다.',
});

await budget.record(result.costUsd);
console.log(result.output.recommendation, result.output.confidence);
```

## 핵심 설계

- **모델**: Claude Opus 4.7 (claude-api 스킬 기본). `HOSTHELPER_AI_MODEL`로 오버라이드 가능.
- **Prompt Caching**: 시스템 프롬프트에 `cache_control: ephemeral` 적용. 반복 호출 시 입력 비용 약 90% 절감.
- **Adaptive Thinking**: `thinking: {type: "adaptive"}`로 Claude가 사고 깊이 자체 조절.
- **구조화된 출력**: zod 스키마로 LLM 응답을 검증. 실패 시 예외.
- **토큰 예산**: Redis 일일 카운터 (UTC 기준). 초과 시 호출 측이 차단.

## 라이선스

`UNLICENSED` (private). M&A·라이선스 문의: hosthelper01@gmail.com
