import { Controller, Param, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { JobService } from './job.service';

@ApiTags('jobs')
@Controller('jobs')
export class JobController {
  constructor(private readonly jobs: JobService) {}

  @Post(':jobId/start')
  async start(@Param('jobId') jobId: string) {
    return this.jobs.start(jobId);
  }

  @Post(':jobId/submit')
  async submit(@Param('jobId') jobId: string) {
    return this.jobs.submit(jobId);
  }

  @Post(':jobId/approve')
  async approve(@Param('jobId') jobId: string) {
    return this.jobs.approve(jobId);
  }
}
