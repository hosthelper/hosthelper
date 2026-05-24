import { Global, Module } from '@nestjs/common';
import { EventsController } from './events.controller';
import { PlatformEventsService } from './platform-events.service';

// @Global: 어느 서비스든 PlatformEventsService를 import 없이 주입해 이벤트 발행 가능.
@Global()
@Module({
  controllers: [EventsController],
  providers: [PlatformEventsService],
  exports: [PlatformEventsService],
})
export class EventsModule {}
