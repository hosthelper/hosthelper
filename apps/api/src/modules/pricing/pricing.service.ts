import { Inject, Injectable } from '@nestjs/common';
import type { PrismaClient } from '@hosthelper/db';
import type { QuoteInput, QuoteOutput } from '@hosthelper/shared';
import { PRISMA } from '../prisma/prisma.module';

// 수익 모델 상수는 ./constants 로 분리 (순수 함수 테스트용). 기존 import 경로 호환 유지.
export { PLATFORM_FEE_KRW, WITHHOLDING_TAX_RATE } from './constants';
import { PLATFORM_FEE_KRW, WITHHOLDING_TAX_RATE } from './constants';

@Injectable()
export class PricingService {
  constructor(@Inject(PRISMA) private readonly prisma: PrismaClient) {}

  async quote(input: QuoteInput): Promise<QuoteOutput> {
    const rule =
      (await this.prisma.pricingRule.findFirst({
        where: { district: input.district, active: true },
        orderBy: { effectiveFrom: 'desc' },
      })) ??
      (await this.prisma.pricingRule.findFirstOrThrow({
        where: { district: null, active: true },
        orderBy: { effectiveFrom: 'desc' },
      }));

    const start = new Date(input.cleaningStartAt);

    const base = rule.baseFee;
    const perPyeong = Math.round(rule.perPyeong * input.pyeong);
    const bedroomAdd = rule.bedroomAdd * input.bedrooms;

    const hour = start.getHours();
    const isNight = hour >= 22 || hour < 6;
    const nightMultiplier = isNight ? Number(rule.nightSurcharge) : 1.0;
    const holidayMultiplier = isHolidayKR(start) ? Number(rule.holidaySurcharge) : 1.0;
    const dynamicCoef = Number(rule.dynamicCoef);

    const preMultiplier = base + perPyeong + bedroomAdd;
    const total = Math.round(preMultiplier * nightMultiplier * holidayMultiplier * dynamicCoef);

    const platformFee = PLATFORM_FEE_KRW;
    const grossToCleaner = Math.max(total - platformFee, 0);
    const withholdingTax = Math.round(grossToCleaner * WITHHOLDING_TAX_RATE);
    const cleanerPayout = grossToCleaner - withholdingTax;

    return {
      total,
      base,
      perPyeong,
      bedroomAdd,
      nightMultiplier,
      holidayMultiplier,
      dynamicCoef,
      platformFee,
      cleanerPayout,
      withholdingTax,
    };
  }
}

// 한국 공휴일 간이 판별. 운영은 외부 캘린더 API 또는 휴일 테이블로 대체.
function isHolidayKR(d: Date): boolean {
  const day = d.getDay();
  return day === 0 || day === 6; // MVP: 주말만, 추후 공휴일 테이블 join
}
