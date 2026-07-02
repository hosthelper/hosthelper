import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import type { PrismaClient } from '@hosthelper/db';
import { PRISMA } from '../prisma/prisma.module';
import type { CreateAvailabilityDto } from '@hosthelper/shared';

// 호스트키퍼 스케줄(가용 시간대) 관리.
// 매칭(MatchingService)은 이 테이블과 예약 구간의 겹침으로 후보를 거른다.
@Injectable()
export class ScheduleService {
  constructor(@Inject(PRISMA) private readonly prisma: PrismaClient) {}

  async addAvailability(dto: CreateAvailabilityDto) {
    const cleaner = await this.prisma.cleanerProfile.findUnique({
      where: { id: dto.cleanerId },
    });
    if (!cleaner) throw new NotFoundException(`Cleaner ${dto.cleanerId} not found`);

    return this.prisma.availability.create({
      data: {
        cleanerId: dto.cleanerId,
        startsAt: new Date(dto.startsAt),
        endsAt: new Date(dto.endsAt),
      },
    });
  }

  async listByCleaner(cleanerId: string) {
    return this.prisma.availability.findMany({
      where: { cleanerId },
      orderBy: { startsAt: 'asc' },
    });
  }

  async remove(id: string) {
    const found = await this.prisma.availability.findUnique({ where: { id } });
    if (!found) throw new NotFoundException(`Availability ${id} not found`);
    await this.prisma.availability.delete({ where: { id } });
    return { deleted: true, id };
  }
}
