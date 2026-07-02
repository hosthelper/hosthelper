import { z } from 'zod';

// 호스트키퍼(청소인력) 가용 시간대 등록. 매칭은 이 구간과 예약 구간의 겹침을 조회한다.
export const CreateAvailabilitySchema = z
  .object({
    cleanerId: z.string().min(1),
    startsAt: z.string().datetime(),
    endsAt: z.string().datetime(),
  })
  .refine((d) => new Date(d.endsAt) > new Date(d.startsAt), {
    message: '종료 시각은 시작 시각보다 이후여야 합니다',
    path: ['endsAt'],
  });

export type CreateAvailabilityDto = z.infer<typeof CreateAvailabilitySchema>;
