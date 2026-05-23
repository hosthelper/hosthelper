import { Worker } from 'bullmq';
import IORedis from 'ioredis';
import { runPayout } from './jobs/payout.processor';
import { runMatchingOffer } from './jobs/matching-offer.processor';
import { closePlatformEvents } from './platform-events';

const connection = new IORedis(process.env.REDIS_URL ?? 'redis://localhost:6379', {
  maxRetriesPerRequest: null,
});

const PAYOUT_QUEUE = 'payout';
const MATCHING_QUEUE = 'matching-offer';

// BullMQ v5: QueueScheduler 통합됨. Worker가 지연/재시도를 직접 처리.
const payoutWorker = new Worker(
  PAYOUT_QUEUE,
  async (job) => runPayout(job.data as { payoutId: string }),
  { connection },
);

const matchingWorker = new Worker(
  MATCHING_QUEUE,
  async (job) => runMatchingOffer(job.data as { jobId: string; roundIdx: number }),
  { connection },
);

for (const w of [payoutWorker, matchingWorker]) {
  w.on('failed', (job, err) => {
    // eslint-disable-next-line no-console
    console.error(`[${w.name}] job ${job?.id} failed:`, err.message);
  });
}

async function shutdown() {
  await Promise.all([payoutWorker.close(), matchingWorker.close()]);
  await Promise.allSettled([connection.quit(), closePlatformEvents()]);
  process.exit(0);
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

// eslint-disable-next-line no-console
console.log('hosthelper worker started');
