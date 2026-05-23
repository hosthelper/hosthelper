import { z } from 'zod';

// 플랫폼 실시간 이벤트 채널 (Redis pub/sub). API·worker가 공유.
export const PLATFORM_EVENTS_CHANNEL = 'platform:events';

// SSE 이벤트 이름 (브라우저 addEventListener 키)
export const SSE_EVENT_SNAPSHOT = 'snapshot';
export const SSE_EVENT_PLATFORM = 'platform';

export const PlatformEventTypeSchema = z.enum([
  'booking.created',
  'payment.confirmed',
  'match.candidates_computed',
  'offer.created',
  'offer.accepted',
  'offer.declined',
  'job.matched',
  'dispute.triaged',
]);
export type PlatformEventType = z.infer<typeof PlatformEventTypeSchema>;

// 모든 이벤트 공통 봉투. title은 UI 표시용 한국어 요약.
const envelope = {
  id: z.string(),
  at: z.string(), // ISO 8601
  title: z.string(),
};

export const PlatformEventSchema = z.discriminatedUnion('type', [
  z.object({
    ...envelope,
    type: z.literal('booking.created'),
    data: z.object({ bookingId: z.string(), district: z.string(), quotedPrice: z.number() }),
  }),
  z.object({
    ...envelope,
    type: z.literal('payment.confirmed'),
    data: z.object({ bookingId: z.string(), amount: z.number() }),
  }),
  z.object({
    ...envelope,
    type: z.literal('match.candidates_computed'),
    data: z.object({ jobId: z.string(), candidateCount: z.number().int(), topScore: z.number() }),
  }),
  z.object({
    ...envelope,
    type: z.literal('offer.created'),
    data: z.object({
      jobId: z.string(),
      roundIdx: z.number().int(),
      cleanerCount: z.number().int(),
      expiresAt: z.string(),
    }),
  }),
  z.object({
    ...envelope,
    type: z.literal('offer.accepted'),
    data: z.object({ jobId: z.string(), cleanerId: z.string() }),
  }),
  z.object({
    ...envelope,
    type: z.literal('offer.declined'),
    data: z.object({ jobId: z.string(), cleanerId: z.string() }),
  }),
  z.object({
    ...envelope,
    type: z.literal('job.matched'),
    data: z.object({ jobId: z.string(), cleanerId: z.string() }),
  }),
  z.object({
    ...envelope,
    type: z.literal('dispute.triaged'),
    data: z.object({
      jobId: z.string(),
      recommendation: z.string(),
      confidence: z.number().nullable(),
    }),
  }),
]);
export type PlatformEvent = z.infer<typeof PlatformEventSchema>;

// id·at은 발행 시점에 서버가 채우므로 입력에서 제외 (discriminated union 보존).
type DistributiveOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never;
export type PlatformEventInput = DistributiveOmit<PlatformEvent, 'id' | 'at'>;

export const KpiSnapshotSchema = z.object({
  at: z.string(),
  activeJobs: z.number().int(), // 진행 중 잡 (MATCHED/IN_PROGRESS/SUBMITTED)
  pendingOffers: z.number().int(), // 대기 중 오퍼 (PENDING & 미만료)
  todayBookings: z.number().int(), // 오늘 생성된 예약 수
  todayGmv: z.number(), // 오늘 거래액 (확정/완료 예약 quotedPrice 합)
  openDisputes: z.number().int(), // 열린 분쟁 (DISPUTED)
});
export type KpiSnapshot = z.infer<typeof KpiSnapshotSchema>;
