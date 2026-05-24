import { randomUUID } from 'node:crypto';
import IORedis from 'ioredis';
import {
  PLATFORM_EVENTS_CHANNEL,
  PlatformEventSchema,
  type PlatformEvent,
  type PlatformEventInput,
} from '@hosthelper/shared';

// worker → Redis 채널로 플랫폼 이벤트 발행. API의 SSE 게이트웨이가 구독해 fan-out.
const publisher = new IORedis(process.env.REDIS_URL ?? 'redis://localhost:6379', {
  maxRetriesPerRequest: null,
  enableOfflineQueue: false,
});
publisher.on('error', (e) => {
  // eslint-disable-next-line no-console
  console.error('[platform-events] redis error:', e.message);
});

export async function publishPlatformEvent(input: PlatformEventInput): Promise<void> {
  const event = {
    ...input,
    id: randomUUID(),
    at: new Date().toISOString(),
  } as PlatformEvent;

  const parsed = PlatformEventSchema.safeParse(event);
  if (!parsed.success) {
    // eslint-disable-next-line no-console
    console.error('[platform-events] invalid event:', parsed.error.message);
    return;
  }
  try {
    await publisher.publish(PLATFORM_EVENTS_CHANNEL, JSON.stringify(parsed.data));
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error('[platform-events] publish failed:', (e as Error).message);
  }
}

export async function closePlatformEvents(): Promise<void> {
  await publisher.quit();
}
