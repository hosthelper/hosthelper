import { Inject, Injectable } from '@nestjs/common';
import type { PrismaClient } from '@hosthelper/db';
import type { QuoteInput, QuoteOutput } from '@hosthelper/shared';
import { PRISMA } from '../prisma/prisma.module';

const PLATFORM_FEE_RATE = 0.18;
const WITHHOLDING_TAX_RATE = 0.033;

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

    const platformFee = Math.round(total * PLATFORM_FEE_RATE);
    const grossToCleaner = total - platformFee;
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
