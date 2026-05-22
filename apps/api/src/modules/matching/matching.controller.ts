import { Controller, Param, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { MatchingService } from './matching.service';

@ApiTags('matching')
@Controller('matching')
export class MatchingController {
  constructor(private readonly matching: MatchingService) {}

  @Post('jobs/:jobId/candidates')
  async findCandidates(@Param('jobId') jobId: string) {
    const candidates = await this.matching.findCandidates(jobId);
    return { jobId, candidates };
  }
}
