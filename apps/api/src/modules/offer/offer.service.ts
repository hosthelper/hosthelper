import {
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { PrismaClient } from '@hosthelper/db';
import { PRISMA } from '../prisma/prisma.module';
import { PlatformEventsService } from '../events/platform-events.service';

// 오퍼 응답 처리. 워커(matching-offer.processor)가 라운드별로 오퍼를 발행하고,
// 키퍼가 여기서 수락/거절한다. 수락 = 잡 배정 확정(MATCHED).
@Injectable()
export class OfferService {
  constructor(
    @Inject(PRISMA) private readonly prisma: PrismaClient,
    private readonly events: PlatformEventsService,
  ) {}

  // 키퍼별 응답 대기 중 오퍼 (만료 전)
  async listPending(cleanerId: string) {
    return this.prisma.offerRound.findMany({
      where: { cleanerId, status: 'PENDING', expiresAt: { gt: new Date() } },
      include: {
        job: { include: { booking: { include: { property: true } } } },
      },
      orderBy: { expiresAt: 'asc' },
    });
  }

  async accept(offerId: string) {
    const offer = await this.prisma.offerRound.findUnique({
      where: { id: offerId },
      include: { job: true },
    });
    if (!offer) throw new NotFoundException(`Offer ${offerId} not found`);
    if (offer.status !== 'PENDING') {
      throw new ConflictException(`이미 응답한 오퍼입니다 (현재: ${offer.status})`);
    }
    if (offer.expiresAt <= new Date()) {
      throw new ConflictException('만료된 오퍼입니다');
    }

    await this.prisma.$transaction(async (tx) => {
      // 조건부 claim으로 동시 수락 경합 차단: REQUESTED인 경우에만 배정
      const claimed = await tx.cleaningJob.updateMany({
        where: { id: offer.jobId, status: 'REQUESTED', cleanerId: null },
        data: { status: 'MATCHED', cleanerId: offer.cleanerId },
      });
      if (claimed.count === 0) {
        throw new ConflictException('이미 다른 키퍼에게 배정된 작업입니다');
      }

      await tx.offerRound.update({
        where: { id: offerId },
        data: { status: 'ACCEPTED', respondedAt: new Date() },
      });
      // 같은 잡의 나머지 대기 오퍼는 만료 처리
      await tx.offerRound.updateMany({
        where: { jobId: offer.jobId, id: { not: offerId }, status: 'PENDING' },
        data: { status: 'EXPIRED' },
      });
    });

    void this.events.emit({
      type: 'offer.accepted',
      title: `오퍼 수락 · 잡 ${offer.jobId.slice(0, 8)}`,
      data: { jobId: offer.jobId, cleanerId: offer.cleanerId },
    });
    void this.events.emit({
      type: 'job.matched',
      title: `키퍼 배정 확정 · 잡 ${offer.jobId.slice(0, 8)}`,
      data: { jobId: offer.jobId, cleanerId: offer.cleanerId },
    });

    return { accepted: true, jobId: offer.jobId, cleanerId: offer.cleanerId };
  }

  async decline(offerId: string) {
    const offer = await this.prisma.offerRound.findUnique({ where: { id: offerId } });
    if (!offer) throw new NotFoundException(`Offer ${offerId} not found`);
    if (offer.status !== 'PENDING') {
      throw new ConflictException(`이미 응답한 오퍼입니다 (현재: ${offer.status})`);
    }

    await this.prisma.offerRound.update({
      where: { id: offerId },
      data: { status: 'DECLINED', respondedAt: new Date() },
    });

    void this.events.emit({
      type: 'offer.declined',
      title: `오퍼 거절 · 잡 ${offer.jobId.slice(0, 8)}`,
      data: { jobId: offer.jobId, cleanerId: offer.cleanerId },
    });

    return { declined: true, jobId: offer.jobId };
  }
}
