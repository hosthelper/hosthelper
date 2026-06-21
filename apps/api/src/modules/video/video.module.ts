import { Module } from '@nestjs/common';
import { AiModule } from '../ai/ai.module';
import { VideoController } from './video.controller';
import { VideoService } from './video.service';

@Module({
  imports: [AiModule], // AI_CLIENT, TOKEN_BUDGET 재사용
  providers: [VideoService],
  controllers: [VideoController],
  exports: [VideoService],
})
export class VideoModule {}
