import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import type { PrismaClient } from '@hosthelper/db';
import { PRISMA } from '../prisma/prisma.module';
import { PlatformEventsService } from '../events/platform-events.service';
import { rankCandidates, type CleanerSnapshot, type JobLocation } from './scoring';

@Injectable()
export class MatchingService {
  constructor(
    @Inject(PRISMA) private readonly prisma: PrismaClient,
    private readonly events: PlatformEventsService,
  ) {}

  // V1 룰베이스 매칭. ADR-0002 참조.
  async findCandidates(jobId: string) {
    const job = await this.prisma.cleaningJob.findUnique({
      where: { id: jobId },
      include: { booking: { include: { property: true } } },
    });
    if (!job) throw new NotFoundException(`Job ${jobId} not found`);

    const weights = await this.prisma.matchingWeights.upsert({
      where: { id: 'default' },
      update: {},
      create: { id: 'default' },
    });

    const startsAt = job.booking.cleaningStartAt;
    const endsAt = job.booking.cleaningEndAt;
    const property = job.booking.property;

    const cleaners = await this.prisma.cleanerProfile.findMany({
      where: {
        active: true,
        kycStatus: 'APPROVED',
        availabilities: {
          some: { startsAt: { lte: startsAt }, endsAt: { gte: endsAt } },
        },
      },
      take: 200,
    });

    const propLoc: JobLocation = {
      lat: Number(property.lat),
      lng: Number(property.lng),
    };

    const snapshots: CleanerSnapshot[] = cleaners
      .filter((c) => c.baseLat !== null && c.baseLng !== null)
      .map((c) => ({
        id: c.id,
        lat: Number(c.baseLat),
        lng: Number(c.baseLng),
        rating: Number(c.rating),
        completedJobs: c.completedJobs,
        rebookingRate: Number(c.rebookingRate),
        declineRate: Number(c.declineRate),
        createdAt: c.createdAt,
      }));

    const ranked = rankCandidates(snapshots, propLoc, {
      wDistance: Number(weights.wDistance),
      wRating: Number(weights.wRating),
      wCompleted: Number(weights.wCompleted),
      wRebooking: Number(weights.wRebooking),
      wDeclinePenalty: Number(weights.wDeclinePenalty),
      newCleanerBoost: Number(weights.newCleanerBoost),
      maxDistanceKm: weights.maxDistanceKm,
      topN: weights.topN,
    });

    // 결정 로그 저장
    await this.prisma.$transaction(
      ranked.map((r) =>
        this.prisma.matchCandidate.upsert({
          where: { jobId_cleanerId: { jobId, cleanerId: r.cleanerId } },
          update: {
            score: r.score,
            distanceKm: r.distanceKm,
            ratingScore: r.ratingScore,
            completedScore: r.completedScore,
            rebookingScore: r.rebookingScore,
            declinePenalty: r.declinePenalty,
            computedAt: new Date(),
          },
          create: {
            jobId,
            cleanerId: r.cleanerId,
            score: r.score,
            distanceKm: r.distanceKm,
            ratingScore: r.ratingScore,
            completedScore: r.completedScore,
            rebookingScore: r.rebookingScore,
            declinePenalty: r.declinePenalty,
          },
        }),
      ),
    );

    const top = ranked[0];
    const topScore = top ? Number(top.score) : 0;
    void this.events.emit({
      type: 'match.candidates_computed',
      title: `후보 ${ranked.length}명 산출 · 최고점 ${topScore.toFixed(3)}`,
      data: { jobId, candidateCount: ranked.length, topScore },
    });

    return ranked;
  }
}
