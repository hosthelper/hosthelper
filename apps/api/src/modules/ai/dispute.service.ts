import {
  Inject,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { analyzeDispute, type AiClient, type DisputeInput, type TokenBudget } from '@hosthelper/ai';
import type { PrismaClient, Decision } from '@hosthelper/db';
import { PRISMA } from '../prisma/prisma.module';
import { AI_CLIENT } from './ai-gateway.provider';
import { TOKEN_BUDGET } from './token-budget.provider';

@Injectable()
export class DisputeService {
  constructor(
    @Inject(PRISMA) private readonly prisma: PrismaClient,
    @Inject(AI_CLIENT) private readonly ai: AiClient,
    @Inject(TOKEN_BUDGET) private readonly budget: TokenBudget,
  ) {}

  async triage(
    jobId: string,
    hostStatement: string,
    cleanerStatement: string,
  ): Promise<Decision> {
    const job = await this.prisma.cleaningJob.findUnique({
      where: { id: jobId },
      include: {
        booking: { include: { property: true } },
        cleaner: { include: { user: true } },
        checklistRuns: { include: { results: true } },
        photos: true,
      },
    });
    if (!job) throw new NotFoundException(`Job ${jobId} not found`);
    if (!job.cleaner) throw new NotFoundException('Job has no assigned cleaner');

    const check = await this.budget.check();
    if (!check.allowed) {
      throw new ServiceUnavailableException({
        message: '오늘의 AI 분석 예산을 초과했습니다',
        spentUsd: check.spentUsd,
        limitUsd: check.limitUsd,
      });
    }

    const checklist: DisputeInput['checklist'] = [];
    for (const run of job.checklistRuns) {
      for (const r of run.results) {
        checklist.push({
          area: 'checklist',
          title: r.itemId,
          checked: r.checked,
          note: r.note ?? undefined,
          photoCount: r.photoIds.length,
        });
      }
      if (checklist.length >= 60) break;
    }

    const input: DisputeInput = {
      jobId: job.id,
      property: {
        nickname: job.booking.property.nickname,
        pyeong: Number(job.booking.property.pyeong),
        bedrooms: job.booking.property.bedrooms,
        district: job.booking.property.district,
      },
      booking: {
        cleaningStartAt: job.booking.cleaningStartAt.toISOString(),
        cleaningEndAt: job.booking.cleaningEndAt.toISOString(),
        quotedPrice: job.booking.quotedPrice,
      },
      cleaner: {
        name: job.cleaner.user.name,
        rating: Number(job.cleaner.rating),
        completedJobs: job.cleaner.completedJobs,
      },
      checklist,
      hostStatement,
      cleanerStatement,
    };

    const t0 = Date.now();
    let result: Awaited<ReturnType<typeof analyzeDispute>> | undefined;
    let errorMessage: string | undefined;
    try {
      result = await analyzeDispute(this.ai, input);
    } catch (e) {
      errorMessage = e instanceof Error ? e.message : 'unknown error';
    }
    const latencyMs = Date.now() - t0;

    return this.prisma.$transaction(async (tx) => {
      const llmCall = await tx.lLMCall.create({
        data: {
          purpose: 'dispute_triage',
          model: result?.modelUsed ?? this.ai.model,
          inputTokens: result?.usage.inputTokens ?? 0,
          outputTokens: result?.usage.outputTokens ?? 0,
          cacheCreationInputTokens: result?.usage.cacheCreationInputTokens ?? 0,
          cacheReadInputTokens: result?.usage.cacheReadInputTokens ?? 0,
          costUsdMicro: Math.round((result?.costUsd ?? 0) * 1_000_000),
          latencyMs,
          success: result != null,
          errorMessage: errorMessage ?? null,
        },
      });

      if (result) {
        await this.budget.record(result.costUsd);
      }

      const decision = await tx.decision.create({
        data: {
          kind: 'DISPUTE_TRIAGE',
          subjectType: 'CleaningJob',
          subjectId: job.id,
          proposedBy: 'AI',
          status: 'PROPOSED',
          summary: result?.output.summary ?? `AI 분석 실패: ${errorMessage ?? 'unknown'}`,
          payload: {
            input,
            output: result?.output ?? null,
            error: errorMessage ?? null,
          } as never,
          confidence: result?.output.confidence ?? null,
          llmCallId: llmCall.id,
        },
        include: { llmCall: true },
      });

      return decision;
    });
  }

  async list(limit: number = 50): Promise<Decision[]> {
    return this.prisma.decision.findMany({
      where: { kind: 'DISPUTE_TRIAGE' },
      orderBy: { createdAt: 'desc' },
      take: Math.min(limit, 200),
      include: { llmCall: true },
    });
  }

  async approve(decisionId: string, decidedBy: 'OPS_HUMAN' | 'AI'): Promise<Decision> {
    return this.prisma.decision.update({
      where: { id: decisionId },
      data: { status: 'APPROVED', decidedBy, decidedAt: new Date() },
    });
  }
}
