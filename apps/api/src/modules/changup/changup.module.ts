import { Module } from '@nestjs/common';
import { ChangupService } from './changup.service';
import { ChangupController } from './changup.controller';

// 창업이지 — 점포 양도 매물·리드 매칭. hosthelper 모듈과 의존 없음 (분리 매각 가능).
@Module({
  providers: [ChangupService],
  controllers: [ChangupController],
  exports: [ChangupService],
})
export class ChangupModule {}
