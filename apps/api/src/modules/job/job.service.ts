import {
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { PrismaClient } from '@hosthelper/db';
import { PRISMA } from '../prisma/prisma.module';
import { PlatformEventsService } from '../events/platform-events.service';
import { computeSettlement, settlementScheduledFor } from './settlement';

// 잡 라이프사이클: MATCHED → IN_PROGRESS → SUBMITTED → APPROVED (→ 워커가 SETTLED)
// 승인 시점에 Payout(SCHEDULED)을 생성하고, 실제 지급은 T+2에 워커가 처리한다.
@Injectable()
export class JobService {
  constructor(
    @Inject(PRISMA) private readonly prisma: PrismaClient,
    private readonly events: PlatformEventsService,
  ) {}

  async start(jobId: string) {
    return this.transition(jobId, 'MATCHED', 'IN_PROGRESS', { startedAt: new Date() }, 'job.started');
  }

  async submit(jobId: string) {
    return this.transition(jobId, 'IN_PROGRESS', 'SUBMITTED', { submittedAt: new Date() }, 'job.submitted');
  }

  // 호스트 승인 → 정산(Payout) 생성. jobId unique로 이중 생성 방지.
  async approve(jobId: string) {
    const job = await this.prisma.cleaningJob.findUnique({
      where: { id: jobId },
      include: { booking: true },
    });
    if (!job) throw new NotFoundException(`Job ${jobId} not found`);
    if (!job.cleanerId) throw new ConflictException('배정된 키퍼가 없습니다');

    const settlement = computeSettlement(job.booking.quotedPrice);
    const now = new Date();

    const payout = await this.prisma.$transaction(async (tx) => {
      const claimed = await tx.cleaningJob.updateMany({
        where: { id: jobId, status: 'SUBMITTED' },
        data: { status: 'APPROVED', approvedAt: now },
      });
      if (claimed.count === 0) {
        throw new ConflictException('SUBMITTED 상태에서만 승인할 수 있습니다');
      }
      return tx.payout.create({
        data: {
          cleanerId: job.cleanerId!,
          jobId,
          gross: settlement.gross,
          platformFee: settlement.platformFee,
          withholdingTax: settlement.withholdingTax,
          net: settlement.net,
          status: 'SCHEDULED',
          scheduledFor: settlementScheduledFor(now),
        },
      });
    });

    void this.events.emit({
      type: 'job.approved',
      title: `작업 승인 · 잡 ${jobId.slice(0, 8)}`,
      data: { jobId, cleanerId: job.cleanerId },
    });
    void this.events.emit({
      type: 'payout.scheduled',
      title: `정산 예약 · 실지급 ₩${settlement.net.toLocaleString()} (T+2)`,
      data: {
        jobId,
        cleanerId: job.cleanerId,
        net: settlement.net,
        scheduledFor: payout.scheduledFor.toISOString(),
      },
    });

    return { job: { id: jobId, status: 'APPROVED' as const }, payout };
  }

  private async transition(
    jobId: string,
    from: 'MATCHED' | 'IN_PROGRESS',
    to: 'IN_PROGRESS' | 'SUBMITTED',
    extra: Record<string, Date>,
    eventType: 'job.started' | 'job.submitted',
  ) {
    const res = await this.prisma.cleaningJob.updateMany({
      where: { id: jobId, status: from },
      data: { status: to, ...extra },
    });
    if (res.count === 0) {
      const exists = await this.prisma.cleaningJob.findUnique({ where: { id: jobId } });
      if (!exists) throw new NotFoundException(`Job ${jobId} not found`);
      throw new ConflictException(`${from} 상태에서만 가능합니다 (현재: ${exists.status})`);
    }

    const job = await this.prisma.cleaningJob.findUniqueOrThrow({ where: { id: jobId } });
    if (job.cleanerId) {
      void this.events.emit({
        type: eventType,
        title: `${eventType === 'job.started' ? '작업 시작' : '완료 제출'} · 잡 ${jobId.slice(0, 8)}`,
        data: { jobId, cleanerId: job.cleanerId },
      });
    }
    return job;
  }
}
