import { z } from 'zod';

/**
 * HostHelper PMS Core contracts.
 *
 * IMPORTANT: the existing `Booking` domain models cleaning-turnover work.
 * Guest-stay reservations use this dedicated PMS namespace so Booking Engine,
 * Channel Manager and RMS can share one lodging source of truth without
 * changing the existing cleaning workflow.
 */

export const PmsReservationStatusEnum = z.enum([
  'HOLD',
  'PENDING',
  'CONFIRMED',
  'CHECKED_IN',
  'CHECKED_OUT',
  'CANCELLED',
  'NO_SHOW',
]);

export const PmsReservationChannelEnum = z.enum([
  'DIRECT',
  'AIRBNB',
  'BOOKING_COM',
  'AGODA',
  'NAVER',
  'LIFEHELPER',
  'MANUAL',
  'OTHER',
]);

export const PmsRoomUnitStatusEnum = z.enum([
  'ACTIVE',
  'OUT_OF_ORDER',
  'INACTIVE',
]);

export const PmsInventoryModeEnum = z.enum(['OPEN', 'CLOSED']);

export const PmsDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, '날짜는 YYYY-MM-DD 형식이어야 합니다');

const CurrencySchema = z
  .string()
  .length(3)
  .transform((value) => value.toUpperCase());

export const CreatePmsRoomTypeSchema = z
  .object({
    propertyId: z.string().cuid(),
    code: z.string().trim().min(1).max(40),
    name: z.string().trim().min(1).max(120),
    maxOccupancy: z.number().int().min(1).max(50),
    baseOccupancy: z.number().int().min(1).max(50),
    totalUnits: z.number().int().min(1).max(500),
    sellable: z.boolean().default(true),
  })
  .strict()
  .refine((value) => value.baseOccupancy <= value.maxOccupancy, {
    message: '기준 인원은 최대 인원을 초과할 수 없습니다',
    path: ['baseOccupancy'],
  });

export const CreatePmsRoomUnitSchema = z
  .object({
    roomTypeId: z.string().cuid(),
    code: z.string().trim().min(1).max(40),
    displayName: z.string().trim().min(1).max(120),
    floor: z.string().trim().max(40).optional(),
    status: PmsRoomUnitStatusEnum.default('ACTIVE'),
  })
  .strict();

export const CreatePmsGuestSchema = z
  .object({
    name: z.string().trim().min(1).max(120),
    email: z.string().email().max(254).optional(),
    phone: z.string().trim().min(5).max(30).optional(),
    countryCode: z.string().trim().length(2).transform((value) => value.toUpperCase()).optional(),
    language: z.string().trim().min(2).max(10).optional(),
  })
  .strict();

export const CreatePmsReservationSchema = z
  .object({
    propertyId: z.string().cuid(),
    roomTypeId: z.string().cuid(),
    roomUnitId: z.string().cuid().optional(),
    guest: CreatePmsGuestSchema,
    checkInDate: PmsDateSchema,
    checkOutDate: PmsDateSchema,
    adults: z.number().int().min(1).max(50),
    children: z.number().int().min(0).max(50).default(0),
    channel: PmsReservationChannelEnum.default('DIRECT'),
    externalReservationId: z.string().trim().max(200).optional(),
    totalAmount: z.number().int().min(0),
    currency: CurrencySchema.default('KRW'),
    notes: z.string().max(2000).optional(),
  })
  .strict()
  .refine(
    (value) => new Date(`${value.checkOutDate}T00:00:00Z`) > new Date(`${value.checkInDate}T00:00:00Z`),
    {
      message: '체크아웃 날짜는 체크인 날짜보다 이후여야 합니다',
      path: ['checkOutDate'],
    },
  );

export const PmsInventoryDaySchema = z
  .object({
    roomTypeId: z.string().cuid(),
    stayDate: PmsDateSchema,
    totalUnits: z.number().int().min(0),
    heldUnits: z.number().int().min(0),
    soldUnits: z.number().int().min(0),
    mode: PmsInventoryModeEnum.default('OPEN'),
    minStay: z.number().int().min(1).max(365).default(1),
  })
  .strict()
  .refine((value) => value.heldUnits + value.soldUnits <= value.totalUnits, {
    message: '홀드와 판매 재고의 합은 전체 객실 수를 초과할 수 없습니다',
    path: ['soldUnits'],
  });

export const PmsReservationTransitionSchema = z
  .object({
    reservationId: z.string().cuid(),
    from: PmsReservationStatusEnum,
    to: PmsReservationStatusEnum,
    reason: z.string().trim().max(500).optional(),
  })
  .strict();

export type PmsReservationStatus = z.infer<typeof PmsReservationStatusEnum>;
export type PmsReservationChannel = z.infer<typeof PmsReservationChannelEnum>;
export type CreatePmsRoomTypeDto = z.infer<typeof CreatePmsRoomTypeSchema>;
export type CreatePmsRoomUnitDto = z.infer<typeof CreatePmsRoomUnitSchema>;
export type CreatePmsGuestDto = z.infer<typeof CreatePmsGuestSchema>;
export type CreatePmsReservationDto = z.infer<typeof CreatePmsReservationSchema>;
export type PmsInventoryDayDto = z.infer<typeof PmsInventoryDaySchema>;

export const PMS_RESERVATION_TRANSITIONS: Readonly<
  Record<PmsReservationStatus, readonly PmsReservationStatus[]>
> = {
  HOLD: ['PENDING', 'CONFIRMED', 'CANCELLED'],
  PENDING: ['CONFIRMED', 'CANCELLED'],
  CONFIRMED: ['CHECKED_IN', 'CANCELLED', 'NO_SHOW'],
  CHECKED_IN: ['CHECKED_OUT'],
  CHECKED_OUT: [],
  CANCELLED: [],
  NO_SHOW: [],
};

export function canTransitionPmsReservation(
  from: PmsReservationStatus,
  to: PmsReservationStatus,
): boolean {
  return PMS_RESERVATION_TRANSITIONS[from].includes(to);
}
