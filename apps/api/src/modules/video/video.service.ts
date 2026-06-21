import {
  BadRequestException,
  Inject,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { analyzeVideo, type AiClient, type TokenBudget, type VideoAnalyzeInput } from '@hosthelper/ai';
import type { VideoAnalysisResponse } from '@hosthelper/shared';
import type { PrismaClient, VideoAnalysis } from '@hosthelper/db';
import { PRISMA } from '../prisma/prisma.module';
import { AI_CLIENT } from '../ai/ai-gateway.provider';
import { TOKEN_BUDGET } from '../ai/token-budget.provider';
import { extractVideo, VideoExtractionError } from './extractor';

@Injectable()
export class VideoService {
  constructor(
    @Inject(PRISMA) private readonly prisma: PrismaClient,
    @Inject(AI_CLIENT) private readonly ai: AiClient,
    @Inject(TOKEN_BUDGET) private readonly budget: TokenBudget,
  ) {}

  async analyze(url: string): Promise<VideoAnalysisResponse> {
    const check = await this.budget.check();
    if (!check.allowed) {
      throw new ServiceUnavailableException({
        message: '오늘의 AI 분석 예산을 초과했습니다',
        spentUsd: check.spentUsd,
        limitUsd: check.limitUsd,
      });
    }

    let extracted;
    try {
      extracted = await extractVideo(url);
    } catch (e) {
      if (e instanceof VideoExtractionError) throw new BadRequestException(e.message);
      throw new BadRequestException('영상 내용을 추출하지 못했습니다.');
    }

    const input: VideoAnalyzeInput = {
      platform: extracted.platform,
      sourceUrl: extracted.sourceUrl,
      title: extracted.title,
      author: extracted.author,
      durationLabel: extracted.durationLabel,
      description: extracted.description,
      transcript: extracted.transcript,
      transcriptLanguage: extracted.transcriptLanguage,
    };

    const t0 = Date.now();
    let result: Awaited<ReturnType<typeof analyzeVideo>> | undefined;
    let errorMessage: string | undefined;
    try {
      result = await analyzeVideo(this.ai, input);
    } catch (e) {
      errorMessage = e instanceof Error ? e.message : 'unknown error';
    }
    const latencyMs = Date.now() - t0;

    // LLMCall은 실패 시에도 토큰 회계를 위해 먼저 영속화 (CLAUDE.md §3.4).
    const llmCall = await this.prisma.lLMCall.create({
      data: {
        purpose: 'video_analysis',
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

    if (!result) {
      throw new ServiceUnavailableException({
        message: 'AI 분석에 실패했습니다. 잠시 후 다시 시도해주세요.',
        detail: errorMessage,
        llmCallId: llmCall.id,
      });
    }

    await this.budget.record(result.costUsd);

    const out = result.output;
    const record = await this.prisma.videoAnalysis.create({
      data: {
        sourceUrl: extracted.sourceUrl,
        platform: extracted.platform,
        videoTitle: extracted.title ?? null,
        author: extracted.author ?? null,
        language: out.language,
        hasTranscript: Boolean(extracted.transcript),
        tldr: out.tldr,
        summary: out.summary,
        keyPoints: out.keyPoints as never,
        topics: out.topics as never,
        contentType: out.contentType,
        confidence: out.confidence,
        payload: { input, output: out } as never,
        llmCallId: llmCall.id,
      },
    });

    return this.toResponse(record, result.output);
  }

  async list(limit: number = 20): Promise<VideoAnalysisResponse[]> {
    const rows = await this.prisma.videoAnalysis.findMany({
      orderBy: { createdAt: 'desc' },
      take: Math.min(limit, 100),
    });
    return rows.map((r) => this.toResponse(r));
  }

  private toResponse(
    row: VideoAnalysis,
    output?: Awaited<ReturnType<typeof analyzeVideo>>['output'],
  ): VideoAnalysisResponse {
    return {
      id: row.id,
      sourceUrl: row.sourceUrl,
      platform: row.platform as 'youtube' | 'web',
      videoTitle: row.videoTitle,
      author: row.author,
      hasTranscript: row.hasTranscript,
      analysis: output ?? {
        tldr: row.tldr,
        summary: row.summary,
        keyPoints: (row.keyPoints as string[]) ?? [],
        topics: (row.topics as string[]) ?? [],
        contentType: row.contentType as VideoAnalysisResponse['analysis']['contentType'],
        language: row.language ?? '알 수 없음',
        confidence: row.confidence != null ? Number(row.confidence) : 0,
      },
      createdAt: row.createdAt.toISOString(),
    };
  }
}
