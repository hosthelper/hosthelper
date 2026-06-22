import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import {
  VideoAnalyzeRequestSchema,
  type VideoAnalyzeRequest,
  type VideoAnalysisResponse,
} from '@hosthelper/shared';
import { ZodPipe } from '../../common/zod.pipe';
import { VideoService } from './video.service';

@ApiTags('ai')
@Controller('ai/video')
export class VideoController {
  constructor(private readonly video: VideoService) {}

  // 링크 하나 받아 영상 내용을 추출·분석해 한국어 요약 + 중요 포인트 반환.
  @Post('analyze')
  analyze(
    @Body(new ZodPipe(VideoAnalyzeRequestSchema)) body: VideoAnalyzeRequest,
  ): Promise<VideoAnalysisResponse> {
    return this.video.analyze(body.url);
  }

  @Get()
  list(@Query('limit') limit?: string): Promise<VideoAnalysisResponse[]> {
    return this.video.list(limit ? Number(limit) : undefined);
  }
}
