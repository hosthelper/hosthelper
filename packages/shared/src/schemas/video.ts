import { z } from 'zod';

// 영상 분석 요청 — 링크 하나만 받습니다 (범용 요약/분석).
export const VideoAnalyzeRequestSchema = z.object({
  url: z
    .string()
    .trim()
    .url('올바른 URL을 입력하세요')
    .max(2048),
});

export type VideoAnalyzeRequest = z.infer<typeof VideoAnalyzeRequestSchema>;

export const VIDEO_CONTENT_TYPES = [
  'educational',
  'tutorial',
  'review',
  'news',
  'entertainment',
  'vlog',
  'marketing',
  'interview',
  'other',
] as const;

export const VideoContentTypeEnum = z.enum(VIDEO_CONTENT_TYPES);
export type VideoContentType = z.infer<typeof VideoContentTypeEnum>;

// AI가 돌려주는 구조화된 분석 결과.
export const VideoAnalysisOutputSchema = z.object({
  tldr: z.string().describe('한 문장 핵심 요약(한국어)'),
  summary: z.string().describe('영상 내용 요약 3-6문장(한국어)'),
  keyPoints: z.array(z.string()).min(1).max(12).describe('중요 포인트 목록(한국어)'),
  topics: z.array(z.string()).max(10).describe('주제 태그(한국어 또는 원어)'),
  contentType: VideoContentTypeEnum,
  language: z.string().describe('영상 원어 추정 (예: "한국어", "영어")'),
  confidence: z.number().min(0).max(1),
});

export type VideoAnalysisOutput = z.infer<typeof VideoAnalysisOutputSchema>;

// API 응답 — 추출 메타 + 분석 결과.
export const VideoAnalysisResponseSchema = z.object({
  id: z.string(),
  sourceUrl: z.string(),
  platform: z.enum(['youtube', 'web']),
  videoTitle: z.string().nullable(),
  author: z.string().nullable(),
  hasTranscript: z.boolean(),
  analysis: VideoAnalysisOutputSchema,
  createdAt: z.string(),
});

export type VideoAnalysisResponse = z.infer<typeof VideoAnalysisResponseSchema>;
