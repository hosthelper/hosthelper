import type { Provider } from '@nestjs/common';
import { TokenBudget } from '@hosthelper/ai';
import IORedis from 'ioredis';

export const TOKEN_BUDGET = Symbol('TOKEN_BUDGET');

export const TokenBudgetProvider: Provider = {
  provide: TOKEN_BUDGET,
  useFactory: (): TokenBudget => {
    const redis = new IORedis(process.env.REDIS_URL ?? 'redis://localhost:6379', {
      maxRetriesPerRequest: null,
      lazyConnect: false,
    });
    const limit = Number(process.env.HOSTHELPER_AI_DAILY_BUDGET_USD ?? '50');
    return new TokenBudget(redis, limit);
  },
};
