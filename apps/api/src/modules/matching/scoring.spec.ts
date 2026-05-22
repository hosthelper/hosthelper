import { rankCandidates, scoreCandidate, type CleanerSnapshot, type ScoringWeights } from './scoring';

const weights: ScoringWeights = {
  wDistance: 0.35,
  wRating: 0.25,
  wCompleted: 0.15,
  wRebooking: 0.15,
  wDeclinePenalty: 0.1,
  newCleanerBoost: 0.1,
  maxDistanceKm: 10,
  topN: 5,
};

const gangnam = { lat: 37.4979, lng: 127.0276 };

function makeCleaner(overrides: Partial<CleanerSnapshot> = {}): CleanerSnapshot {
  return {
    id: 'c-1',
    lat: 37.5,
    lng: 127.03,
    rating: 4.5,
    completedJobs: 30,
    rebookingRate: 0.4,
    declineRate: 0.05,
    createdAt: new Date('2025-01-01'),
    ...overrides,
  };
}

describe('scoring', () => {
  it('returns null when cleaner is further than maxDistanceKm', () => {
    const far = makeCleaner({ lat: 38.0, lng: 128.0 });
    expect(scoreCandidate(far, gangnam, weights)).toBeNull();
  });

  it('penalizes high decline rate', () => {
    const clean = makeCleaner({ id: 'a', declineRate: 0.05 });
    const flaky = makeCleaner({ id: 'b', declineRate: 0.5 });
    const a = scoreCandidate(clean, gangnam, weights)!;
    const b = scoreCandidate(flaky, gangnam, weights)!;
    expect(a.score).toBeGreaterThan(b.score);
  });

  it('boosts new cleaners within 30 days', () => {
    const newCleaner = makeCleaner({ id: 'new', createdAt: new Date() });
    const oldCleaner = makeCleaner({ id: 'old', createdAt: new Date('2024-01-01') });
    const n = scoreCandidate(newCleaner, gangnam, weights)!;
    const o = scoreCandidate(oldCleaner, gangnam, weights)!;
    expect(n.score).toBeGreaterThan(o.score);
  });

  it('rankCandidates returns up to topN sorted by score desc', () => {
    const cleaners = [
      makeCleaner({ id: 'a', rating: 5.0 }),
      makeCleaner({ id: 'b', rating: 3.0 }),
      makeCleaner({ id: 'c', rating: 4.0 }),
    ];
    const ranked = rankCandidates(cleaners, gangnam, { ...weights, topN: 2 });
    expect(ranked).toHaveLength(2);
    expect(ranked[0]!.cleanerId).toBe('a');
  });

  it('skips out-of-range cleaners in rank', () => {
    const cleaners = [
      makeCleaner({ id: 'near', lat: 37.5, lng: 127.03 }),
      makeCleaner({ id: 'far', lat: 38.0, lng: 128.0 }),
    ];
    const ranked = rankCandidates(cleaners, gangnam, weights);
    expect(ranked.map((r) => r.cleanerId)).toEqual(['near']);
  });
});
