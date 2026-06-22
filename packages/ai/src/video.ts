import {
  VIDEO_CONTENT_TYPES,
  VideoAnalysisOutputSchema,
  type VideoAnalysisOutput,
  type VideoPlatform,
} from '@hosthelper/shared';
import type { AiClient } from './client';
import { estimateCostUsd, type TokenUsage } from './budget';

// 추출된 영상 콘텐츠 (자막/설명/메타). 추출은 API 레이어 책임,
// 이 함수는 순수하게 "텍스트 → 구조화 분석"만 담당합니다.
export interface VideoAnalyzeInput {
  platform: VideoPlatform;
  sourceUrl: string;
  title?: string;
  author?: string;
  durationLabel?: string;
  description?: string;
  transcript?: string;
  transcriptLanguage?: string;
}

const PLATFORM_LABEL: Record<VideoPlatform, string> = {
  youtube: '유튜브',
  instagram: '인스타그램',
  tiktok: '틱톡',
  facebook: '페이스북',
  twitter: 'X(트위터)',
  vimeo: '비메오',
  web: '웹',
};

// 토큰 폭주 방지 — 자막/설명은 상한까지만 사용.
const MAX_TRANSCRIPT_CHARS = 24_000;
const MAX_DESCRIPTION_CHARS = 4_000;

// 시스템 프롬프트는 안정적(불변) → prompt caching 키 안정. 타임스탬프/UUID 금지.
const SYSTEM_PROMPT = `당신은 영상 콘텐츠 분석가입니다. 자막·설명·메타데이터가 주어지면 영상 내용을 한국어로 명확하게 요약합니다.

[역할]
- 영상의 자막(transcript) 또는 설명을 읽고, 핵심 내용을 빠르게 파악할 수 있도록 정리합니다.
- 영상을 직접 보지 못한 사람도 무엇을 다루는지 1분 안에 이해하게 만드는 것이 목표입니다.

[작성 원칙]
- 반드시 한국어로 출력합니다. (영상 원어가 무엇이든 요약은 한국어)
- tldr: 영상 전체를 한 문장으로.
- summary: 3~6문장. 영상의 흐름과 결론을 담습니다. 군더더기·홍보 문구는 제외.
- keyPoints: 영상에서 가장 중요한 포인트를 항목별로. 각 항목은 한 문장, 구체적으로. 5~10개 권장.
- topics: 영상이 다루는 주제 태그.
- contentType: 영상 성격을 분류.
- language: 자막/설명으로 추정한 영상 원어.
- confidence: 자막이 충실할수록 높게, 제목/설명만 있으면 낮게 (0.0~1.0).

[자료 한계 처리]
- 자막이 없고 제목·설명만 주어지면, 추정임을 요약 톤에 반영하고 confidence를 0.4 이하로 둡니다.
- 광고·후원 안내, 구독 유도, 타임스탬프 나열은 핵심에서 제외합니다.

[금지 사항]
- 자료에 없는 사실을 지어내지 않습니다. 불확실하면 불확실하다고 적습니다.
- 욕설·비방·차별적 표현 금지.
`;

export interface AnalyzeVideoResult {
  output: VideoAnalysisOutput;
  usage: TokenUsage;
  costUsd: number;
  modelUsed: string;
  rawText: string;
}

function truncate(s: string, max: number): string {
  if (s.length <= max) return s;
  return `${s.slice(0, max)}\n…(이하 ${s.length - max}자 생략)`;
}

function buildUserPrompt(input: VideoAnalyzeInput): string {
  const lines: string[] = ['# 영상 정보', ''];
  lines.push(`- 출처: ${PLATFORM_LABEL[input.platform] ?? '웹'}`);
  lines.push(`- URL: ${input.sourceUrl}`);
  if (input.title) lines.push(`- 제목: ${input.title}`);
  if (input.author) lines.push(`- 채널/작성자: ${input.author}`);
  if (input.durationLabel) lines.push(`- 길이: ${input.durationLabel}`);
  if (input.transcriptLanguage) lines.push(`- 자막 언어: ${input.transcriptLanguage}`);

  if (input.description) {
    lines.push('', '## 설명', truncate(input.description, MAX_DESCRIPTION_CHARS));
  }

  if (input.transcript && input.transcript.trim().length > 0) {
    lines.push('', '## 자막 (transcript)', truncate(input.transcript, MAX_TRANSCRIPT_CHARS));
  } else {
    lines.push(
      '',
      '## 자막 (transcript)',
      '(자막을 가져오지 못했습니다. 제목·설명만으로 추정해 분석하고 confidence를 낮게 설정하세요.)',
    );
  }

  lines.push('', '위 자료를 바탕으로 영상 내용을 분석해 요약하세요.');
  return lines.join('\n');
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

function safeJson(s: string): unknown {
  try {
    return JSON.parse(s);
  } catch {
    return undefined;
  }
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

// 의존성 추가 없이 zod → JSON Schema 변환 (영상 분석 스키마 한정).
function videoOutputJsonSchema(): unknown {
  return {
    type: 'object',
    properties: {
      tldr: { type: 'string' },
      summary: { type: 'string' },
      keyPoints: { type: 'array', items: { type: 'string' }, minItems: 1, maxItems: 12 },
      topics: { type: 'array', items: { type: 'string' }, maxItems: 10 },
      contentType: { type: 'string', enum: [...VIDEO_CONTENT_TYPES] },
      language: { type: 'string' },
      confidence: { type: 'number', minimum: 0, maximum: 1 },
    },
    required: ['tldr', 'summary', 'keyPoints', 'topics', 'contentType', 'language', 'confidence'],
    additionalProperties: false,
  };
}

export async function analyzeVideo(
  client: AiClient,
  input: VideoAnalyzeInput,
): Promise<AnalyzeVideoResult> {
  const userPrompt = buildUserPrompt(input);

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
              JSON.stringify(videoOutputJsonSchema(), null, 2),
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
  const validated = VideoAnalysisOutputSchema.safeParse(parsed);
  if (!validated.success) {
    throw new Error(`LLM 응답이 스키마를 만족하지 않습니다: ${validated.error.message}`);
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
