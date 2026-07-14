// 창업이지 매수자 리드 ↔ 점포 매물 룰베이스 매칭 점수. 순수 함수로 유지(테스트 용이).
// 참조: docs/adr/ADR-0003-changup-store-match.md
import type { ChangupWeights, ListingMatchScore, OperationType } from '@hosthelper/shared';

export interface LeadCriteria {
  operationTypes: OperationType[];
  industries: string[];
  regions: string[];
  depositMax: number | null; // 원, null = 무제한
  rentMax: number | null;
  premiumMax: number | null;
}

export interface ListingSnapshot {
  id: string;
  industry: string;
  region: string;
  operationType: OperationType;
  deposit: number; // 원
  monthlyRent: number;
  premium: number;
}

const NEUTRAL = 0.5; // 리드가 해당 조건을 지정하지 않았을 때의 중립 점수

function normalize(s: string): string {
  return s.trim().toLowerCase();
}

// 희망 목록 대비 일치 점수. 미지정=중립, 포함=1, 불일치=0.
// 지역은 "마포" ⊂ "마포구" 같은 부분 일치를 허용하기 위해 양방향 substring 비교.
function membershipScore(wanted: string[], actual: string, substring: boolean): number {
  if (wanted.length === 0) return NEUTRAL;
  const a = normalize(actual);
  const hit = wanted.some((w) => {
    const n = normalize(w);
    return substring ? a.includes(n) || n.includes(a) : a === n;
  });
  return hit ? 1 : 0;
}

// 상한 대비 여유율: 1 − price/max (0..1). 상한 미지정 차원은 평균에서 제외.
function budgetHeadroom(lead: LeadCriteria, l: ListingSnapshot): number {
  const dims: Array<[number | null, number]> = [
    [lead.depositMax, l.deposit],
    [lead.rentMax, l.monthlyRent],
    [lead.premiumMax, l.premium],
  ];
  const active = dims.filter(([max]) => max !== null) as Array<[number, number]>;
  if (active.length === 0) return NEUTRAL;
  const sum = active.reduce(
    (acc, [max, price]) => acc + Math.min(Math.max(1 - price / max, 0), 1),
    0,
  );
  return sum / active.length;
}

export function scoreListing(
  lead: LeadCriteria,
  l: ListingSnapshot,
  w: ChangupWeights,
): ListingMatchScore | null {
  // 하드 필터: 예산 상한 초과 매물은 제외 (업종·지역은 소프트 — 빈 결과 방지)
  if (lead.depositMax !== null && l.deposit > lead.depositMax) return null;
  if (lead.rentMax !== null && l.monthlyRent > lead.rentMax) return null;
  if (lead.premiumMax !== null && l.premium > lead.premiumMax) return null;

  const industryScore = membershipScore(lead.industries, l.industry, false);
  const regionScore = membershipScore(lead.regions, l.region, true);
  const operationScore =
    lead.operationTypes.length === 0
      ? NEUTRAL
      : lead.operationTypes.includes(l.operationType)
        ? 1
        : 0;
  const budgetScore = budgetHeadroom(lead, l);

  const score =
    w.wIndustry * industryScore +
    w.wRegion * regionScore +
    w.wOperation * operationScore +
    w.wBudget * budgetScore;

  return { listingId: l.id, score, industryScore, regionScore, operationScore, budgetScore };
}

export function rankListings(
  lead: LeadCriteria,
  listings: ListingSnapshot[],
  w: ChangupWeights,
): ListingMatchScore[] {
  return listings
    .map((l) => scoreListing(lead, l, w))
    .filter((s): s is ListingMatchScore => s !== null)
    .sort((a, b) => b.score - a.score)
    .slice(0, w.topN);
}
