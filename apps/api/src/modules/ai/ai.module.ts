import { Module } from '@nestjs/common';
import { DisputeController } from './dispute.controller';
import { DisputeService } from './dispute.service';
import { AiGatewayProvider } from './ai-gateway.provider';
import { TokenBudgetProvider } from './token-budget.provider';

@Module({
  providers: [DisputeService, AiGatewayProvider, TokenBudgetProvider],
  controllers: [DisputeController],
  exports: [DisputeService],
})
export class AiModule {}
