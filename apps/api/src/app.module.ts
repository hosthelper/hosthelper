import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { HealthController } from './health.controller';
import { PrismaModule } from './modules/prisma/prisma.module';
import { AuthModule } from './modules/auth/auth.module';
import { MatchingModule } from './modules/matching/matching.module';
import { PricingModule } from './modules/pricing/pricing.module';
import { BookingModule } from './modules/booking/booking.module';
import { PaymentModule } from './modules/payment/payment.module';
import { ScheduleModule } from './modules/schedule/schedule.module';
import { OfferModule } from './modules/offer/offer.module';
import { JobModule } from './modules/job/job.module';
import { AiModule } from './modules/ai/ai.module';
import { EventsModule } from './modules/events/events.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    EventsModule,
    AuthModule,
    MatchingModule,
    PricingModule,
    BookingModule,
    PaymentModule,
    ScheduleModule,
    OfferModule,
    JobModule,
    AiModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
