import { Body, Controller, Delete, Get, Param, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { CreateAvailabilitySchema, type CreateAvailabilityDto } from '@hosthelper/shared';
import { ZodPipe } from '../../common/zod.pipe';
import { ScheduleService } from './schedule.service';

@ApiTags('schedule')
@Controller('schedule')
export class ScheduleController {
  constructor(private readonly schedule: ScheduleService) {}

  @Post('availabilities')
  async create(@Body(new ZodPipe(CreateAvailabilitySchema)) dto: CreateAvailabilityDto) {
    return this.schedule.addAvailability(dto);
  }

  @Get('cleaners/:cleanerId/availabilities')
  async list(@Param('cleanerId') cleanerId: string) {
    const availabilities = await this.schedule.listByCleaner(cleanerId);
    return { cleanerId, availabilities };
  }

  @Delete('availabilities/:id')
  async remove(@Param('id') id: string) {
    return this.schedule.remove(id);
  }
}
