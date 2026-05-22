import { z } from 'zod';

export const CreateBookingSchema = z
  .object({
    propertyId: z.string().cuid(),
    cleaningStartAt: z.string().datetime(),
    cleaningEndAt: z.string().datetime(),
    notes: z.string().max(2000).optional(),
  })
  .refine((d) => new Date(d.cleaningEndAt) > new Date(d.cleaningStartAt), {
    message: '종료 시각은 시작 시각보다 이후여야 합니다',
    path: ['cleaningEndAt'],
  });

export const JobStatusEnum = z.enum([
  'REQUESTED',
  'MATCHED',
  'IN_PROGRESS',
  'SUBMITTED',
  'APPROVED',
  'SETTLED',
  'DISPUTED',
  'CANCELLED',
]);

export type CreateBookingDto = z.infer<typeof CreateBookingSchema>;
export type JobStatus = z.infer<typeof JobStatusEnum>;
