import { Body, Controller, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CreateBookingSchema, type CreateBookingDto } from '@hosthelper/shared';
import { ZodPipe } from '../../common/zod.pipe';
import { BookingService } from './booking.service';

@ApiTags('booking')
@ApiBearerAuth()
@Controller('bookings')
export class BookingController {
  constructor(private readonly booking: BookingService) {}

  @Post()
  async create(@Body(new ZodPipe(CreateBookingSchema)) dto: CreateBookingDto) {
    // TODO: extract hostUserId from JWT (AuthGuard)
    const stubHostUserId = 'stub-host-user-id';
    return this.booking.create(stubHostUserId, dto);
  }
}
