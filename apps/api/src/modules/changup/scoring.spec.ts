import { DEFAULT_CHANGUP_WEIGHTS } from '@hosthelper/shared';
import { LeadCriteria, ListingSnapshot, rankListings, scoreListing } from './scoring';

const W = DEFAULT_CHANGUP_WEIGHTS;

const openLead: LeadCriteria = {
  operationTypes: [],
  industries: [],
  regions: [],
  depositMax: null,
  rentMax: null,
  premiumMax: null,
};

function listing(overrides: Partial<ListingSnapshot> = {}): ListingSnapshot {
  return {
    id: 'l1',
    industry: '카페',
    region: '마포구',
    operationType: 'FULL_AUTO',
    deposit: 30_000_000,
    monthlyRent: 2_000_000,
    premium: 50_000_000,
    ...overrides,
  };
}

describe('scoreListing', () => {
  it('조건 전부 미지정 리드는 모든 차원 중립(0.5)', () => {
    const s = scoreListing(openLead, listing(), W)!;
    expect(s.industryScore).toBe(0.5);
    expect(s.regionScore).toBe(0.5);
    expect(s.operationScore).toBe(0.5);
    expect(s.budgetScore).toBe(0.5);
    expect(s.score).toBeCloseTo(0.5 * (W.wIndustry + W.wRegion + W.wOperation + W.wBudget));
  });

  it('보증금 상한 초과 시 하드 필터(null)', () => {
    const lead = { ...openLead, depositMax: 20_000_000 };
    expect(scoreListing(lead, listing({ deposit: 30_000_000 }), W)).toBeNull();
  });

  it('월세 상한 초과 시 하드 필터(null)', () => {
    const lead = { ...openLead, rentMax: 1_000_000 };
    expect(scoreListing(lead, listing({ monthlyRent: 1_500_000 }), W)).toBeNull();
  });

  it('권리금 상한 초과 시 하드 필터(null)', () => {
    const lead = { ...openLead, premiumMax: 10_000_000 };
    expect(scoreListing(lead, listing({ premium: 50_000_000 }), W)).toBeNull();
  });

  it('상한과 정확히 같은 가격은 통과 (여유율 0)', () => {
    const lead = { ...openLead, depositMax: 30_000_000 };
    const s = scoreListing(lead, listing({ deposit: 30_000_000 }), W)!;
    expect(s.budgetScore).toBe(0);
  });

  it('업종: 공백·대소문자 정규화 후 일치=1, 불일치=0', () => {
    const lead = { ...openLead, industries: [' 카페 ', 'Bar'] };
    expect(scoreListing(lead, listing({ industry: '카페' }), W)!.industryScore).toBe(1);
    expect(scoreListing(lead, listing({ industry: 'BAR' }), W)!.industryScore).toBe(1);
    expect(scoreListing(lead, listing({ industry: '치킨' }), W)!.industryScore).toBe(0);
  });

  it('지역: 부분 일치 허용 ("마포" ⊂ "마포구", 역방향 포함)', () => {
    expect(
      scoreListing({ ...openLead, regions: ['마포'] }, listing({ region: '마포구' }), W)!
        .regionScore,
    ).toBe(1);
    expect(
      scoreListing({ ...openLead, regions: ['마포구'] }, listing({ region: '마포' }), W)!
        .regionScore,
    ).toBe(1);
    expect(
      scoreListing({ ...openLead, regions: ['강남구'] }, listing({ region: '마포구' }), W)!
        .regionScore,
    ).toBe(0);
  });

  it('운영 방식: 포함=1, 불포함=0', () => {
    const lead: LeadCriteria = { ...openLead, operationTypes: ['DIRECT', 'FULL_AUTO'] };
    expect(scoreListing(lead, listing({ operationType: 'FULL_AUTO' }), W)!.operationScore).toBe(1);
    expect(scoreListing(lead, listing({ operationType: 'CONSIGNMENT' }), W)!.operationScore).toBe(
      0,
    );
  });

  it('예산 여유율: 지정된 차원만 평균 (1 − price/max)', () => {
    // 보증금 3천/상한 6천 → 0.5, 월세 200/상한 400 → 0.5, 권리금 미지정 → 제외
    const lead = { ...openLead, depositMax: 60_000_000, rentMax: 4_000_000 };
    const s = scoreListing(lead, listing(), W)!;
    expect(s.budgetScore).toBeCloseTo(0.5);
  });

  it('가중 합산이 breakdown과 일치', () => {
    const lead: LeadCriteria = {
      operationTypes: ['FULL_AUTO'],
      industries: ['카페'],
      regions: ['마포'],
      depositMax: 60_000_000,
      rentMax: null,
      premiumMax: null,
    };
    const s = scoreListing(lead, listing(), W)!;
    expect(s.score).toBeCloseTo(
      W.wIndustry * s.industryScore +
        W.wRegion * s.regionScore +
        W.wOperation * s.operationScore +
        W.wBudget * s.budgetScore,
    );
  });
});

describe('rankListings', () => {
  it('점수 내림차순 정렬 + 하드 필터 제외', () => {
    const lead: LeadCriteria = {
      ...openLead,
      industries: ['카페'],
      regions: ['마포'],
      depositMax: 50_000_000,
    };
    const ranked = rankListings(
      lead,
      [
        listing({ id: 'perfect' }), // 업종·지역 일치
        listing({ id: 'wrong-industry', industry: '치킨' }),
        listing({ id: 'over-budget', deposit: 100_000_000 }), // 필터 아웃
      ],
      W,
    );
    expect(ranked.map((r) => r.listingId)).toEqual(['perfect', 'wrong-industry']);
    expect(ranked[0]!.score).toBeGreaterThan(ranked[1]!.score);
  });

  it('topN 절단', () => {
    const many = Array.from({ length: 15 }, (_, i) => listing({ id: `l${i}` }));
    expect(rankListings(openLead, many, W)).toHaveLength(W.topN);
  });

  it('빈 매물 목록 → 빈 배열', () => {
    expect(rankListings(openLead, [], W)).toEqual([]);
  });
});
