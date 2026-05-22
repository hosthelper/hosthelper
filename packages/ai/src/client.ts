import Anthropic from '@anthropic-ai/sdk';

export interface AiClientConfig {
  apiKey?: string;
  baseURL?: string;
  timeout?: number;
  maxRetries?: number;
}

export interface AiClient {
  anthropic: Anthropic;
  model: string;
}

export function createAiClient(config: AiClientConfig = {}): AiClient {
  const anthropic = new Anthropic({
    apiKey: config.apiKey ?? process.env.ANTHROPIC_API_KEY,
    baseURL: config.baseURL,
    timeout: config.timeout ?? 60_000,
    maxRetries: config.maxRetries ?? 2,
  });
  return {
    anthropic,
    model: process.env.HOSTHELPER_AI_MODEL ?? 'claude-opus-4-7',
  };
}
