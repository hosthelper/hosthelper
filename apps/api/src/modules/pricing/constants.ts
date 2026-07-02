// 수익 모델 상수 (순수 파일 — DB 의존 없음, 단위 테스트에서 직접 사용).
// 수익 모델: 건당 정액 수수료 ₩10,000
// 청소사(호스트키퍼) 정산 = 결제액 - 플랫폼수수료 - 원천세(3.3%)
export const PLATFORM_FEE_KRW = 10_000;
export const WITHHOLDING_TAX_RATE = 0.033;
