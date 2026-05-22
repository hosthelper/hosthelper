import type Redis from 'ioredis';

// Opus 4.7 단가 (USD/1M tokens) — 모델 변경 시 갱신 필요.
// 출처: claude-api 스킬 캐시. 운영 가격은 https://platform.claude.com/docs/en/pricing 로 검증.
const PRICING: Record<string, { input: number; output: number; cacheRead: number; cacheWrite: number }> = {
  'claude-opus-4-7': { input: 5.0, output: 25.0, cacheRead: 0.5, cacheWrite: 6.25 },
  'claude-opus-4-6': { input: 5.0, output: 25.0, cacheRead: 0.5, cacheWrite: 6.25 },
  'claude-sonnet-4-6': { input: 3.0, output: 15.0, cacheRead: 0.3, cacheWrite: 3.75 },
  'claude-haiku-4-5': { input: 1.0, output: 5.0, cacheRead: 0.1, cacheWrite: 1.25 },
};

export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
  cacheCreationInputTokens?: number;
  cacheReadInputTokens?: number;
}

export type CostUsd = number;

export function estimateCostUsd(model: string, usage: TokenUsage): CostUsd {
  const p = PRICING[model] ?? PRICING['claude-opus-4-7']!;
  const inCost = (usage.inputTokens / 1_000_000) * p.input;
  const outCost = (usage.outputTokens / 1_000_000) * p.output;
  const writeCost = ((usage.cacheCreationInputTokens ?? 0) / 1_000_000) * p.cacheWrite;
  const readCost = ((usage.cacheReadInputTokens ?? 0) / 1_000_000) * p.cacheRead;
  return inCost + outCost + writeCost + readCost;
}

export interface BudgetCheckResult {
  allowed: boolean;
  spentUsd: number;
  limitUsd: number;
  remainingUsd: number;
}

export class TokenBudget {
  constructor(
    private readonly redis: Redis,
    private readonly dailyLimitUsd: number,
  ) {}

  private todayKey(now: Date = new Date()): string {
    const y = now.getUTCFullYear();
    const m = String(now.getUTCMonth() + 1).padStart(2, '0');
    const d = String(now.getUTCDate()).padStart(2, '0');
    return `ai_budget:${y}-${m}-${d}`;
  }

  async check(): Promise<BudgetCheckResult> {
    const key = this.todayKey();
    const raw = await this.redis.get(key);
    const spentUsd = raw ? Number(raw) / 10_000 : 0;
    return {
      allowed: spentUsd < this.dailyLimitUsd,
      spentUsd,
      limitUsd: this.dailyLimitUsd,
      remainingUsd: Math.max(0, this.dailyLimitUsd - spentUsd),
    };
  }

  // costUsd를 1/10000 단위 정수로 저장 (Redis 정수 연산 정확도).
  async record(costUsd: CostUsd): Promise<number> {
    const key = this.todayKey();
    const delta = Math.max(0, Math.round(costUsd * 10_000));
    const total = await this.redis.incrby(key, delta);
    await this.redis.expire(key, 60 * 60 * 48); // 48h TTL
    return total / 10_000;
  }
}
