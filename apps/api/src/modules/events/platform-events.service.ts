import {
  Inject,
  Injectable,
  Logger,
  type MessageEvent,
  type OnModuleDestroy,
  type OnModuleInit,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import IORedis from 'ioredis';
import { Observable, Subject, from, interval, merge, of } from 'rxjs';
import { catchError, filter, map, startWith, switchMap } from 'rxjs/operators';
import type { PrismaClient } from '@hosthelper/db';
import {
  PLATFORM_EVENTS_CHANNEL,
  PlatformEventSchema,
  SSE_EVENT_PLATFORM,
  SSE_EVENT_SNAPSHOT,
  type KpiSnapshot,
  type PlatformEvent,
  type PlatformEventInput,
} from '@hosthelper/shared';
import { PRISMA } from '../prisma/prisma.module';

const SNAPSHOT_INTERVAL_MS = 5_000;

// 플랫폼 실시간 이벤트 게이트웨이.
// - emit(): 도메인 이벤트를 Redis 채널로 발행 (다중 인스턴스/worker fan-out).
// - stream(): Redis 구독 이벤트 + 주기적 KPI 스냅샷을 SSE로 합쳐서 제공.
@Injectable()
export class PlatformEventsService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PlatformEventsService.name);
  private publisher!: IORedis;
  private subscriber!: IORedis;
  private readonly events$ = new Subject<PlatformEvent>();

  constructor(@Inject(PRISMA) private readonly prisma: PrismaClient) {}

  onModuleInit(): void {
    const url = process.env.REDIS_URL ?? 'redis://localhost:6379';
    // 발행은 best-effort 텔레메트리. Redis 단절 시 즉시 실패(catch)하도록 오프라인 큐 비활성화.
    this.publisher = new IORedis(url, { maxRetriesPerRequest: null, enableOfflineQueue: false });
    this.subscriber = new IORedis(url, { maxRetriesPerRequest: null });

    // Redis 장애가 비즈니스 흐름을 깨지 않도록 에러는 로깅만 한다.
    this.publisher.on('error', (e) => this.logger.warn(`publisher redis: ${e.message}`));
    this.subscriber.on('error', (e) => this.logger.warn(`subscriber redis: ${e.message}`));

    this.subscriber
      .subscribe(PLATFORM_EVENTS_CHANNEL)
      .catch((e: Error) => this.logger.warn(`subscribe failed: ${e.message}`));

    this.subscriber.on('message', (channel, message) => {
      if (channel !== PLATFORM_EVENTS_CHANNEL) return;
      try {
        const parsed = PlatformEventSchema.safeParse(JSON.parse(message));
        if (parsed.success) this.events$.next(parsed.data);
        else this.logger.warn(`dropped malformed event: ${parsed.error.message}`);
      } catch {
        // JSON 파싱 실패는 무시
      }
    });
  }

  async onModuleDestroy(): Promise<void> {
    this.events$.complete();
    await Promise.allSettled([this.publisher?.quit(), this.subscriber?.quit()]);
  }

  // 도메인 이벤트 발행 (fire-and-forget 권장). 실패해도 throw하지 않는다.
  async emit(input: PlatformEventInput): Promise<void> {
    const event = {
      ...input,
      id: randomUUID(),
      at: new Date().toISOString(),
    } as PlatformEvent;

    const parsed = PlatformEventSchema.safeParse(event);
    if (!parsed.success) {
      this.logger.warn(`invalid platform event: ${parsed.error.message}`);
      return;
    }
    try {
      await this.publisher.publish(PLATFORM_EVENTS_CHANNEL, JSON.stringify(parsed.data));
    } catch (e) {
      this.logger.warn(`event publish failed: ${(e as Error).message}`);
    }
  }

  // SSE 스트림: 즉시 스냅샷 1회 + 5초 간격 스냅샷 + 실시간 이벤트.
  stream(): Observable<MessageEvent> {
    const snapshot$ = interval(SNAPSHOT_INTERVAL_MS).pipe(
      startWith(-1),
      switchMap(() =>
        from(this.computeKpiSnapshot()).pipe(
          catchError((e: Error) => {
            this.logger.warn(`kpi snapshot failed: ${e.message}`);
            return of<KpiSnapshot | null>(null);
          }),
        ),
      ),
      filter((snapshot): snapshot is KpiSnapshot => snapshot !== null),
      map((snapshot): MessageEvent => ({ type: SSE_EVENT_SNAPSHOT, data: snapshot })),
    );

    const live$ = this.events$.asObservable().pipe(
      map((event): MessageEvent => ({ type: SSE_EVENT_PLATFORM, data: event })),
    );

    return merge(snapshot$, live$);
  }

  async computeKpiSnapshot(): Promise<KpiSnapshot> {
    const now = new Date();
    const startOfDay = new Date(now);
    startOfDay.setHours(0, 0, 0, 0);

    const [activeJobs, pendingOffers, todayBookings, openDisputes, gmv] = await Promise.all([
      this.prisma.cleaningJob.count({
        where: { status: { in: ['MATCHED', 'IN_PROGRESS', 'SUBMITTED'] } },
      }),
      this.prisma.offerRound.count({ where: { status: 'PENDING', expiresAt: { gt: now } } }),
      this.prisma.booking.count({ where: { createdAt: { gte: startOfDay } } }),
      this.prisma.cleaningJob.count({ where: { status: 'DISPUTED' } }),
      this.prisma.booking.aggregate({
        _sum: { quotedPrice: true },
        where: { createdAt: { gte: startOfDay }, status: { in: ['CONFIRMED', 'COMPLETED'] } },
      }),
    ]);

    return {
      at: now.toISOString(),
      activeJobs,
      pendingOffers,
      todayBookings,
      todayGmv: gmv._sum.quotedPrice ?? 0,
      openDisputes,
    };
  }
}
