import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { z } from 'zod';
import type { Decision } from '@hosthelper/db';
import { ZodPipe } from '../../common/zod.pipe';
import { DisputeService } from './dispute.service';

const TriageBodySchema = z.object({
  hostStatement: z.string().min(1).max(4000),
  cleanerStatement: z.string().min(1).max(4000),
});

@ApiTags('ai')
@Controller('ai/disputes')
export class DisputeController {
  constructor(private readonly dispute: DisputeService) {}

  @Post(':jobId/triage')
  triage(
    @Param('jobId') jobId: string,
    @Body(new ZodPipe(TriageBodySchema))
    body: { hostStatement: string; cleanerStatement: string },
  ): Promise<Decision> {
    return this.dispute.triage(jobId, body.hostStatement, body.cleanerStatement);
  }

  @Get()
  list(@Query('limit') limit?: string): Promise<Decision[]> {
    return this.dispute.list(limit ? Number(limit) : undefined);
  }

  @Post(':decisionId/approve')
  approve(@Param('decisionId') decisionId: string): Promise<Decision> {
    return this.dispute.approve(decisionId, 'OPS_HUMAN');
  }
}
