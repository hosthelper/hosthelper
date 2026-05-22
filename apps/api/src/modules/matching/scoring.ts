// V1 룰베이스 매칭 점수 계산. 순수 함수로 유지(테스트 용이).
// 참조: docs/adr/ADR-0002-matching-algorithm.md

export interface JobLocation {
  lat: number;
  lng: number;
}

export interface CleanerSnapshot {
  id: string;
  lat: number;
  lng: number;
  rating: number; // 0..5
  completedJobs: number;
  rebookingRate: number; // 0..1
  declineRate: number; // 0..1
  createdAt: Date;
}

export interface ScoringWeights {
  wDistance: number;
  wRating: number;
  wCompleted: number;
  wRebooking: number;
  wDeclinePenalty: number;
  newCleanerBoost: number;
  maxDistanceKm: number;
  topN: number;
}

export interface CandidateScore {
  cleanerId: string;
  score: number;
  distanceKm: number;
  ratingScore: number;
  completedScore: number;
  rebookingScore: number;
  declinePenalty: number;
}

const EARTH_RADIUS_KM = 6371;

function haversineKm(a: JobLocation, b: JobLocation): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(h));
}

export function scoreCandidate(
  c: CleanerSnapshot,
  loc: JobLocation,
  w: ScoringWeights,
  now: Date = new Date(),
): CandidateScore | null {
  const distanceKm = haversineKm(loc, c);
  if (distanceKm > w.maxDistanceKm) return null;

  // 정규화 (0..1)
  const distanceScore = 1 / (1 + distanceKm); // 가까울수록 높음
  const ratingScore = Math.min(c.rating, 5) / 5;
  const completedScore = Math.min(Math.log10(1 + c.completedJobs) / 2, 1); // 100건 ≈ 1.0
  const rebookingScore = Math.min(Math.max(c.rebookingRate, 0), 1);
  const declinePenalty = Math.min(Math.max(c.declineRate, 0), 1);

  let score =
    w.wDistance * distanceScore +
    w.wRating * ratingScore +
    w.wCompleted * completedScore +
    w.wRebooking * rebookingScore -
    w.wDeclinePenalty * declinePenalty;

  // 신규(30일) 청소사 부스트
  const daysSinceJoin = (now.getTime() - c.createdAt.getTime()) / 86400000;
  if (daysSinceJoin <= 30) score += w.newCleanerBoost;

  return {
    cleanerId: c.id,
    score: Math.max(0, score),
    distanceKm,
    ratingScore,
    completedScore,
    rebookingScore,
    declinePenalty,
  };
}

export function rankCandidates(
  cleaners: CleanerSnapshot[],
  loc: JobLocation,
  w: ScoringWeights,
  now: Date = new Date(),
): CandidateScore[] {
  return cleaners
    .map((c) => scoreCandidate(c, loc, w, now))
    .filter((s): s is CandidateScore => s !== null)
    .sort((a, b) => b.score - a.score)
    .slice(0, w.topN);
}
