import { PLATFORM_FEE_KRW, WITHHOLDING_TAX_RATE } from './pricing.service';

describe('Pricing constants', () => {
  it('platform fee is a flat ₩10,000 per booking', () => {
    expect(PLATFORM_FEE_KRW).toBe(10_000);
  });

  it('withholding tax is 3.3%', () => {
    expect(WITHHOLDING_TAX_RATE).toBeCloseTo(0.033);
  });
});

// Quote 통합 테스트는 PrismaService mock + e2e 사양에서 별도 다룬다.
// 여기는 정책 상수 잠금 테스트만 둔다.
