import type { Provider } from '@nestjs/common';
import { createAiClient, type AiClient } from '@hosthelper/ai';

export const AI_CLIENT = Symbol('AI_CLIENT');

export const AiGatewayProvider: Provider = {
  provide: AI_CLIENT,
  useFactory: (): AiClient => createAiClient(),
};
