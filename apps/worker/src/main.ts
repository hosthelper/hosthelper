import { Worker, QueueScheduler } from 'bullmq';
import IORedis from 'ioredis';
import { runPayout } from './jobs/payout.processor';
import { runMatchingOffer } from './jobs/matching-offer.processor';

const connection = new IORedis(process.env.REDIS_URL ?? 'redis://localhost:6379', {
  maxRetriesPerRequest: null,
});

const PAYOUT_QUEUE = 'payout';
const MATCHING_QUEUE = 'matching-offer';

new QueueScheduler(PAYOUT_QUEUE, { connection });
new QueueScheduler(MATCHING_QUEUE, { connection });

new Worker(
  PAYOUT_QUEUE,
  async (job) => runPayout(job.data as { payoutId: string }),
  { connection },
);

new Worker(
  MATCHING_QUEUE,
  async (job) => runMatchingOffer(job.data as { jobId: string; roundIdx: number }),
  { connection },
);

// eslint-disable-next-line no-console
console.log('hosthelper worker started');
