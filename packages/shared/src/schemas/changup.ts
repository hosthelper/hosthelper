import { z } from 'zod';

// 창업이지 (Changup) — 점포 양도 매물 · 예비창업자 리드 매칭 DTO
// 참조: docs/adr/ADR-0003-changup-store-match.md

export const OperationTypeSchema = z.enum([
  'DIRECT', // 직영
  'FULL_AUTO', // 풀오토
  'CONSIGNMENT', // 위탁
  'FRANCHISE_HQ', // 본사
]);

export const StoreListingStatusSchema = z.enum(['ACTIVE', 'RESERVED', 'SOLD']);
export const LeadStatusSchema = z.enum(['NEW', 'CONTACTED', 'MEETING_SET', 'CLOSED']);
export const ContactChannelSchema = z.enum(['PHONE', 'SMS', 'KAKAO']);

export const OPERATION_TYPE_LABELS: Record<z.infer<typeof OperationTypeSchema>, string> = {
  DIRECT: '직영',
  FULL_AUTO: '풀오토',
  CONSIGNMENT: '위탁',
  FRANCHISE_HQ: '본사',
};

export const STORE_LISTING_STATUS_LABELS: Record<
  z.infer<typeof StoreListingStatusSchema>,
  string
> = {
  ACTIVE: '판매중',
  RESERVED: '예약중',
  SOLD: '양도완료',
};

export const LEAD_STATUS_LABELS: Record<z.infer<typeof LeadStatusSchema>, string> = {
  NEW: '신규',
  CONTACTED: '연락완료',
  MEETING_SET: '미팅확정',
  CLOSED: '종료',
};

export const CONTACT_CHANNEL_LABELS: Record<z.infer<typeof ContactChannelSchema>, string> = {
  PHONE: '전화',
  SMS: '문자',
  KAKAO: '카카오톡',
};

const krwAmount = z.number().int().nonnegative();
const krwMax = z.number().int().positive().nullable();

// 공개 설문 제출 (예비창업자 리드)
export const BuyerLeadSurveySchema = z.object({
  name: z.string().trim().min(1).max(50),
  phone: z
    .string()
    .trim()
    .regex(/^01[0-9]-?\d{3,4}-?\d{4}$/, '휴대폰 번호 형식이 아닙니다'),
  contactChannel: ContactChannelSchema.default('PHONE'),
  operationTypes: z.array(OperationTypeSchema).min(1, '운영 방식을 선택하세요'),
  industries: z.array(z.string().trim().min(1).max(30)).max(10).default([]),
  regions: z.array(z.string().trim().min(1).max(30)).max(10).default([]),
  depositMax: krwMax.default(null), // 보증금 상한 (원, null = 무제한)
  rentMax: krwMax.default(null), // 월세 상한 (원)
  premiumMax: krwMax.default(null), // 권리금 상한 (원)
  notes: z.string().trim().max(2000).optional(),
  website: z.string().optional(), // 허니팟 — 값이 있으면 봇으로 간주하고 저장 생략
});

export const StoreListingUpsertSchema = z.object({
  title: z.string().trim().min(1).max(100),
  description: z.string().trim().max(5000).optional(),
  industry: z.string().trim().min(1).max(30),
  region: z.string().trim().min(1).max(30),
  operationType: OperationTypeSchema,
  deposit: krwAmount, // 보증금 (원)
  monthlyRent: krwAmount, // 월세 (원)
  premium: krwAmount, // 권리금 (원)
  status: StoreListingStatusSchema.default('ACTIVE'),
});

export const LeadStatusUpdateSchema = z.object({
  status: LeadStatusSchema,
});

export const ListingMatchScoreSchema = z.object({
  listingId: z.string(),
  score: z.number().min(0).max(1),
  industryScore: z.number().min(0).max(1),
  regionScore: z.number().min(0).max(1),
  operationScore: z.number().min(0).max(1),
  budgetScore: z.number().min(0).max(1),
});

export const ChangupWeightsSchema = z.object({
  wIndustry: z.number().min(0).max(1),
  wRegion: z.number().min(0).max(1),
  wOperation: z.number().min(0).max(1),
  wBudget: z.number().min(0).max(1),
  topN: z.number().int().positive(),
});

// MVP는 상수 가중치 (DB 테이블 아님 — ADR-0003)
export const DEFAULT_CHANGUP_WEIGHTS: z.infer<typeof ChangupWeightsSchema> = {
  wIndustry: 0.35,
  wRegion: 0.3,
  wOperation: 0.15,
  wBudget: 0.2,
  topN: 10,
};

export type OperationType = z.infer<typeof OperationTypeSchema>;
export type StoreListingStatus = z.infer<typeof StoreListingStatusSchema>;
export type LeadStatus = z.infer<typeof LeadStatusSchema>;
export type ContactChannel = z.infer<typeof ContactChannelSchema>;
export type BuyerLeadSurvey = z.infer<typeof BuyerLeadSurveySchema>;
export type StoreListingUpsert = z.infer<typeof StoreListingUpsertSchema>;
export type LeadStatusUpdate = z.infer<typeof LeadStatusUpdateSchema>;
export type ListingMatchScore = z.infer<typeof ListingMatchScoreSchema>;
export type ChangupWeights = z.infer<typeof ChangupWeightsSchema>;
