import { Module } from '@nestjs/common';
import { DisputeController } from './dispute.controller';
import { DisputeService } from './dispute.service';
import { AiGatewayProvider, AI_CLIENT } from './ai-gateway.provider';
import { TokenBudgetProvider, TOKEN_BUDGET } from './token-budget.provider';

@Module({
  providers: [DisputeService, AiGatewayProvider, TokenBudgetProvider],
  controllers: [DisputeController],
  // AI 클라이언트·예산 가드는 다른 AI 기능 모듈(video 등)에서 재사용.
  exports: [DisputeService, AI_CLIENT, TOKEN_BUDGET],
})
export class AiModule {}
