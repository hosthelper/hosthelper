import { PLATFORM_FEE_KRW, WITHHOLDING_TAX_RATE } from '../pricing/constants';

// 정산 계산 (순수 함수). Booking 스냅샷(quotedPrice) 기준으로 Payout 금액을 산출한다.
// pricing.service.quote()의 cleanerPayout 계산과 동일한 의미를 유지해야 한다.
// 정산 스케줄: T+2 (분쟁 윈도우 종료 후 지급, payout.processor 참조)
export const SETTLEMENT_DELAY_DAYS = 2;

export interface SettlementBreakdown {
  gross: number; // 호스트 결제 총액
  platformFee: number; // 플랫폼 정액 수수료 (₩10,000/건)
  withholdingTax: number; // 사업소득 원천세 3.3%
  net: number; // 키퍼 실지급액
}

export function computeSettlement(quotedPrice: number): SettlementBreakdown {
  const platformFee = PLATFORM_FEE_KRW;
  const grossToCleaner = Math.max(quotedPrice - platformFee, 0);
  const withholdingTax = Math.round(grossToCleaner * WITHHOLDING_TAX_RATE);
  const net = grossToCleaner - withholdingTax;
  return { gross: quotedPrice, platformFee, withholdingTax, net };
}

export function settlementScheduledFor(from: Date): Date {
  return new Date(from.getTime() + SETTLEMENT_DELAY_DAYS * 24 * 60 * 60 * 1000);
}
