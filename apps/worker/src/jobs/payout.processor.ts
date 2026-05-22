import { prisma } from '@hosthelper/db';

// T+2 정산 처리. 분쟁 윈도우 종료 후 실제 송금 (PG 또는 펌뱅킹).
// 멱등성: status가 PAID/RELEASED인 경우 skip.
export async function runPayout({ payoutId }: { payoutId: string }) {
  const payout = await prisma.payout.findUnique({ where: { id: payoutId } });
  if (!payout) return { skipped: true, reason: 'not-found' };
  if (payout.status === 'PAID' || payout.status === 'RELEASED') {
    return { skipped: true, reason: 'already-processed' };
  }

  // 분쟁 상태면 보류
  const job = await prisma.cleaningJob.findFirst({
    where: { id: payout.jobId },
  });
  if (job?.status === 'DISPUTED') {
    await prisma.payout.update({
      where: { id: payout.id },
      data: { status: 'HOLD_ON_DISPUTE' },
    });
    return { held: true };
  }

  // TODO: 실제 펌뱅킹 또는 PG 정산 API 호출
  // 멱등키 = payout.id
  await prisma.payout.update({
    where: { id: payout.id },
    data: { status: 'PAID', paidAt: new Date(), releasedAt: new Date() },
  });

  return { paid: true, payoutId };
}
