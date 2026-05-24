import { prisma } from '@hosthelper/db';
import { publishPlatformEvent } from '../platform-events';

// 매칭 오퍼 라운드. Top N 후보에게 푸시 후 TTL 동안 응답 대기.
// TTL 초과 시 다음 라운드 enqueue. maxRounds 도달 시 운영팀 알림.
export async function runMatchingOffer({
  jobId,
  roundIdx,
}: {
  jobId: string;
  roundIdx: number;
}) {
  const weights = await prisma.matchingWeights.findUniqueOrThrow({ where: { id: 'default' } });

  // 이미 매칭됐으면 종료
  const job = await prisma.cleaningJob.findUnique({ where: { id: jobId } });
  if (!job || job.status !== 'REQUESTED') return { skipped: true };

  if (roundIdx > weights.maxRounds) {
    // TODO: 운영팀 슬랙/카톡 알림
    return { exhausted: true, jobId };
  }

  // 이번 라운드에 이미 오퍼받지 않은 후보 중 score 상위 N명
  const offeredCleanerIds = (
    await prisma.offerRound.findMany({
      where: { jobId },
      select: { cleanerId: true },
    })
  ).map((o) => o.cleanerId);

  const candidates = await prisma.matchCandidate.findMany({
    where: { jobId, cleanerId: { notIn: offeredCleanerIds } },
    orderBy: { score: 'desc' },
    take: weights.topN,
  });

  const expiresAt = new Date(Date.now() + weights.offerTtlMinutes * 60_000);
  await prisma.$transaction(
    candidates.map((c) =>
      prisma.offerRound.create({
        data: {
          jobId,
          cleanerId: c.cleanerId,
          roundIdx,
          expiresAt,
        },
      }),
    ),
  );

  // TODO: 푸시/알림톡 발송

  if (candidates.length > 0) {
    await publishPlatformEvent({
      type: 'offer.created',
      title: `오퍼 발송 · 라운드 ${roundIdx} · ${candidates.length}명`,
      data: {
        jobId,
        roundIdx,
        cleanerCount: candidates.length,
        expiresAt: expiresAt.toISOString(),
      },
    });
  }

  return { offered: candidates.length, roundIdx, expiresAt };
}
