import { estimateCostUsd } from './budget';

describe('estimateCostUsd', () => {
  it('Opus 4.7 단가로 입출력 비용 계산', () => {
    const cost = estimateCostUsd('claude-opus-4-7', {
      inputTokens: 1_000_000,
      outputTokens: 1_000_000,
    });
    expect(cost).toBeCloseTo(5 + 25, 5);
  });

  it('Haiku 4.5는 더 저렴', () => {
    const opus = estimateCostUsd('claude-opus-4-7', {
      inputTokens: 3000,
      outputTokens: 500,
    });
    const haiku = estimateCostUsd('claude-haiku-4-5', {
      inputTokens: 3000,
      outputTokens: 500,
    });
    expect(haiku).toBeLessThan(opus);
  });

  it('cache read 비용은 input 10% 수준', () => {
    const noCache = estimateCostUsd('claude-opus-4-7', {
      inputTokens: 1_000_000,
      outputTokens: 0,
    });
    const withCache = estimateCostUsd('claude-opus-4-7', {
      inputTokens: 0,
      outputTokens: 0,
      cacheReadInputTokens: 1_000_000,
    });
    expect(withCache).toBeCloseTo(noCache * 0.1, 5);
  });

  it('알 수 없는 모델은 Opus 4.7 단가로 폴백', () => {
    const fallback = estimateCostUsd('unknown-model' as never, {
      inputTokens: 1_000_000,
      outputTokens: 0,
    });
    expect(fallback).toBeCloseTo(5, 5);
  });
});
