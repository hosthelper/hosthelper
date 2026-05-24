import { Controller, Get, type MessageEvent, Sse } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { Observable } from 'rxjs';
import type { KpiSnapshot } from '@hosthelper/shared';
import { PlatformEventsService } from './platform-events.service';

@ApiTags('events')
@Controller('events')
export class EventsController {
  constructor(private readonly events: PlatformEventsService) {}

  // SSE: GET /api/events/stream — 실시간 KPI 스냅샷 + 플랫폼 이벤트.
  @Sse('stream')
  stream(): Observable<MessageEvent> {
    return this.events.stream();
  }

  // 단발 KPI 조회 (디버깅/비-SSE 클라이언트용).
  @Get('snapshot')
  snapshot(): Promise<KpiSnapshot> {
    return this.events.computeKpiSnapshot();
  }
}
