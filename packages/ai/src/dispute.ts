import { z } from 'zod';
import type { AiClient } from './client';
import { estimateCostUsd, type TokenUsage } from './budget';

export const DisputeInputSchema = z.object({
  jobId: z.string(),
  property: z.object({
    nickname: z.string(),
    pyeong: z.number(),
    bedrooms: z.number(),
    district: z.string(),
  }),
  booking: z.object({
    cleaningStartAt: z.string(),
    cleaningEndAt: z.string(),
    quotedPrice: z.number(),
  }),
  cleaner: z.object({
    name: z.string(),
    rating: z.number(),
    completedJobs: z.number(),
  }),
  checklist: z
    .array(
      z.object({
        area: z.string(),
        title: z.string(),
        checked: z.boolean(),
        note: z.string().optional(),
        photoCount: z.number(),
      }),
    )
    .max(60),
  hostStatement: z.string().max(4000),
  cleanerStatement: z.string().max(4000),
});

export type DisputeInput = z.infer<typeof DisputeInputSchema>;

export const DisputeOutputSchema = z.object({
  summary: z.string().describe('분쟁 핵심을 1-2문장으로 한국어 요약'),
  evidence_quality: z.enum(['strong', 'mixed', 'weak']),
  recommendation: z.enum([
    'side_with_host',
    'side_with_cleaner',
    'partial_refund',
    'needs_human_review',
  ]),
  partial_refund_amount_krw: z
    .number()
    .int()
    .nonnegative()
    .nullable()
    .describe('부분 환불 권고 금액(원). recommendation=partial_refund일 때만 양수, 그 외 null'),
  reasoning: z.string().describe('판단 근거를 한국어로 3-5문장'),
  confidence: z.number().min(0).max(1),
  requires_human_review: z.boolean().describe('운영자 추가 검토 필요 여부'),
});

export type DisputeOutput = z.infer<typeof DisputeOutputSchema>;

// 시스템 프롬프트는 안정적(불변) → prompt caching 키 안정.
// 평가자 페르소나, 정책, 출력 스키마 가이드를 명시.
const SYSTEM_PROMPT = `당신은 호스트헬퍼(수익형 숙박 청소 매칭 SaaS)의 분쟁 1차 분석가입니다.

[역할]
- 호스트와 청소사의 분쟁을 객관적으로 분석하고 운영팀이 빠르게 결정할 수 있도록 권고안을 제시합니다.
- 최종 판정은 운영자가 합니다. 당신은 보조 분석가입니다.

[판정 정책]
- 사진 검수 의무 항목이 누락된 경우 청소사 책임으로 기울입니다.
- 호스트가 청소 후 게스트 체크인 직전에 발견한 사항이며 사진 증거가 있을 때 청소사 책임에 가깝습니다.
- 호스트의 일반적 불만(주관적 인상)에는 신중하게, 청소사 측 사진/체크리스트가 충실하면 청소사를 옹호합니다.
- 양측 진술이 충돌하고 사진/체크리스트로 결판이 안 나면 needs_human_review.
- 청소사 신뢰도(평점, 완료 횟수)가 매우 높고 분쟁 빈도가 낮으면 가중치를 부여하되 결정적 증거가 아닙니다.
- partial_refund는 결제액의 5% ~ 50% 범위 내에서 권고합니다.

[출력 형식]
- 반드시 한국어로 출력합니다.
- 모든 필드를 채워야 합니다.
- recommendation != "partial_refund"일 때 partial_refund_amount_krw는 null로 설정합니다.
- confidence는 양측 진술과 증거가 명확할수록 높게 (0.0~1.0).

[금지 사항]
- 욕설/비방/감정적 표현 금지.
- 개인 신상정보(주민번호, 은행계좌)는 출력하지 않습니다.
- 법적 책임 단정 표현 ("형사처벌", "고소") 금지 — 운영자 판단 영역입니다.
`;

export interface AnalyzeDisputeResult {
  output: DisputeOutput;
  usage: TokenUsage;
  costUsd: number;
  modelUsed: string;
  rawText: string;
}

function buildUserPrompt(input: DisputeInput): string {
  const checklistLines = input.checklist
    .map(
      (c) =>
        `- [${c.area}] ${c.title} — ${c.checked ? '완료' : '미완료'} (사진 ${c.photoCount}장)${
          c.note ? ` · 메모: ${c.note}` : ''
        }`,
    )
    .join('\n');

  return `# 분쟁 정보

## 청소 일감
- Job ID: ${input.jobId}
- 숙소: ${input.property.nickname} (${input.property.district}, ${input.property.pyeong}평, 침실 ${input.property.bedrooms})
- 청소 시작: ${input.booking.cleaningStartAt}
- 청소 종료: ${input.booking.cleaningEndAt}
- 결제액: ₩${input.booking.quotedPrice.toLocaleString()}

## 청소사 정보
- 이름: ${input.cleaner.name}
- 평점: ${input.cleaner.rating.toFixed(2)}/5.00
- 완료 청소 수: ${input.cleaner.completedJobs}

## 체크리스트 결과 (총 ${input.checklist.length}항목)
${checklistLines || '(체크리스트 없음)'}

## 호스트 진술
${input.hostStatement}

## 청소사 진술
${input.cleanerStatement}

위 정보를 바탕으로 정책에 따라 분석하고 권고안을 출력하세요.`;
}

function extractTextFromContent(content: unknown[]): string {
  const parts: string[] = [];
  for (const block of content) {
    if (
      typeof block === 'object' &&
      block !== null &&
      'type' in block &&
      (block as { type: string }).type === 'text' &&
      'text' in block
    ) {
      parts.push(String((block as { text: string }).text));
    }
  }
  return parts.join('');
}

function tryParseJsonFromText(text: string): unknown {
  const trimmed = text.trim();
  const direct = safeJson(trimmed);
  if (direct !== undefined) return direct;
  const match = trimmed.match(/\{[\s\S]*\}/);
  if (match) {
    const fenced = safeJson(match[0]);
    if (fenced !== undefined) return fenced;
  }
  return undefined;
}

function safeJson(s: string): unknown {
  try {
    return JSON.parse(s);
  } catch {
    return undefined;
  }
}

export async function analyzeDispute(
  client: AiClient,
  input: DisputeInput,
): Promise<AnalyzeDisputeResult> {
  const userPrompt = buildUserPrompt(input);

  // 시스템 프롬프트에 cache_control 적용 — 분쟁 콜이 반복되면 비용 90% 절감.
  // claude-api 스킬 §Prompt Caching 참조.
  const response = await client.anthropic.messages.create({
    model: client.model,
    max_tokens: 2048,
    system: [
      {
        type: 'text',
        text: SYSTEM_PROMPT,
        cache_control: { type: 'ephemeral' },
      },
    ],
    thinking: { type: 'adaptive' },
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text:
              userPrompt +
              '\n\n반드시 다음 JSON 스키마에 정확히 일치하는 객체 하나만 출력하세요. 코드펜스, 추가 설명 금지.\n\n' +
              JSON.stringify(zodToJsonSchemaLite(DisputeOutputSchema), null, 2),
          },
        ],
      },
    ],
  });

  const rawText = extractTextFromContent(response.content as unknown[]);
  const parsed = tryParseJsonFromText(rawText);
  if (parsed === undefined) {
    throw new Error('LLM 응답에서 JSON을 추출할 수 없습니다');
  }
  const validated = DisputeOutputSchema.safeParse(parsed);
  if (!validated.success) {
    throw new Error(
      `LLM 응답이 스키마를 만족하지 않습니다: ${validated.error.message}`,
    );
  }

  const usage: TokenUsage = {
    inputTokens: response.usage.input_tokens ?? 0,
    outputTokens: response.usage.output_tokens ?? 0,
    cacheCreationInputTokens: response.usage.cache_creation_input_tokens ?? 0,
    cacheReadInputTokens: response.usage.cache_read_input_tokens ?? 0,
  };
  const costUsd = estimateCostUsd(client.model, usage);

  return {
    output: validated.data,
    usage,
    costUsd,
    modelUsed: client.model,
    rawText,
  };
}

// 의존성 추가 없이 zod → JSON Schema 변환 (분쟁 스키마 한정).
// 본격 확장 시 zod-to-json-schema 패키지 도입 권장.
function zodToJsonSchemaLite(schema: z.ZodTypeAny): unknown {
  // DisputeOutputSchema 전용 정적 스키마. 실제 zod 트래버스 대신 명시.
  if (schema === DisputeOutputSchema) {
    return {
      type: 'object',
      properties: {
        summary: { type: 'string' },
        evidence_quality: { type: 'string', enum: ['strong', 'mixed', 'weak'] },
        recommendation: {
          type: 'string',
          enum: ['side_with_host', 'side_with_cleaner', 'partial_refund', 'needs_human_review'],
        },
        partial_refund_amount_krw: { type: ['integer', 'null'] },
        reasoning: { type: 'string' },
        confidence: { type: 'number', minimum: 0, maximum: 1 },
        requires_human_review: { type: 'boolean' },
      },
      required: [
        'summary',
        'evidence_quality',
        'recommendation',
        'partial_refund_amount_krw',
        'reasoning',
        'confidence',
        'requires_human_review',
      ],
      additionalProperties: false,
    };
  }
  throw new Error('Unsupported schema for zodToJsonSchemaLite');
}
