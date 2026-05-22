export { createAiClient, type AiClient, type AiClientConfig } from './client';
export {
  TokenBudget,
  type BudgetCheckResult,
  type CostUsd,
  type TokenUsage,
  estimateCostUsd,
} from './budget';
export {
  analyzeDispute,
  type DisputeInput,
  type DisputeOutput,
  DisputeOutputSchema,
} from './dispute';

export const AI_VERSION = '0.1.0';
export const DEFAULT_MODEL = 'claude-opus-4-7' as const;
