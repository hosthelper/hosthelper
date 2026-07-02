import {
  SETTLEMENT_DELAY_DAYS,
  computeSettlement,
  settlementScheduledFor,
} from './settlement';

describe('computeSettlement', () => {
  it('일반 케이스: 10만원 결제 → 수수료 1만 + 원천세 3.3% 차감', () => {
    const s = computeSettlement(100_000);
    expect(s.gross).toBe(100_000);
    expect(s.platformFee).toBe(10_000);
    expect(s.withholdingTax).toBe(2_970); // (100000-10000) * 0.033
    expect(s.net).toBe(87_030);
  });

  it('pricing.service 시드 단가 케이스: 136,000원 견적', () => {
    // 기본 시드: base 50000 + 22평*3000 + 침실2*10000 = 136000
    const s = computeSettlement(136_000);
    expect(s.withholdingTax).toBe(Math.round(126_000 * 0.033));
    expect(s.net).toBe(126_000 - Math.round(126_000 * 0.033));
    expect(s.gross - s.platformFee - s.withholdingTax).toBe(s.net);
  });

  it('결제액이 수수료 이하면 키퍼 지급액 0 (음수 금지)', () => {
    const s = computeSettlement(10_000);
    expect(s.withholdingTax).toBe(0);
    expect(s.net).toBe(0);

    const s2 = computeSettlement(0);
    expect(s2.net).toBe(0);
    expect(s2.withholdingTax).toBe(0);
  });

  it('원 단위 반올림: 원천세는 정수', () => {
    const s = computeSettlement(87_777);
    expect(Number.isInteger(s.withholdingTax)).toBe(true);
    expect(Number.isInteger(s.net)).toBe(true);
    expect(s.net + s.withholdingTax + s.platformFee).toBe(s.gross);
  });
});

describe('settlementScheduledFor', () => {
  it('T+2 정산 스케줄', () => {
    const from = new Date('2026-07-01T00:00:00Z');
    const scheduled = settlementScheduledFor(from);
    const diffDays = (scheduled.getTime() - from.getTime()) / 86_400_000;
    expect(diffDays).toBe(SETTLEMENT_DELAY_DAYS);
  });
});
