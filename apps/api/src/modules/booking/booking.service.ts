import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import type { PrismaClient } from '@hosthelper/db';
import { PRISMA } from '../prisma/prisma.module';
import { PricingService } from '../pricing/pricing.service';
import { PlatformEventsService } from '../events/platform-events.service';
import type { CreateBookingDto } from '@hosthelper/shared';

@Injectable()
export class BookingService {
  constructor(
    @Inject(PRISMA) private readonly prisma: PrismaClient,
    private readonly pricing: PricingService,
    private readonly events: PlatformEventsService,
  ) {}

  async create(hostUserId: string, dto: CreateBookingDto) {
    const hostProfile = await this.prisma.hostProfile.findUniqueOrThrow({
      where: { userId: hostUserId },
    });
    const property = await this.prisma.property.findUnique({ where: { id: dto.propertyId } });
    if (!property || property.hostId !== hostProfile.id) {
      throw new NotFoundException('Property not found');
    }

    const quote = await this.pricing.quote({
      district: property.district,
      pyeong: Number(property.pyeong),
      bedrooms: property.bedrooms,
      cleaningStartAt: dto.cleaningStartAt,
      cleaningEndAt: dto.cleaningEndAt,
    });

    const booking = await this.prisma.booking.create({
      data: {
        hostId: hostProfile.id,
        propertyId: property.id,
        cleaningStartAt: new Date(dto.cleaningStartAt),
        cleaningEndAt: new Date(dto.cleaningEndAt),
        notes: dto.notes,
        status: 'PENDING_PAYMENT',
        quotedPrice: quote.total,
        platformFee: quote.platformFee,
        cleanerPayout: quote.cleanerPayout,
        job: { create: { status: 'REQUESTED' } },
      },
      include: { job: true },
    });

    void this.events.emit({
      type: 'booking.created',
      title: `예약 생성 · ${property.district} ${property.nickname} (₩${quote.total.toLocaleString()})`,
      data: { bookingId: booking.id, district: property.district, quotedPrice: quote.total },
    });

    return { booking, quote };
  }
}
