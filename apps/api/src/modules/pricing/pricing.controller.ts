import { Body, Controller, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { QuoteInputSchema } from '@hosthelper/shared';
import { PricingService } from './pricing.service';
import { ZodPipe } from '../../common/zod.pipe';

@ApiTags('pricing')
@Controller('pricing')
export class PricingController {
  constructor(private readonly pricing: PricingService) {}

  @Post('quote')
  async quote(@Body(new ZodPipe(QuoteInputSchema)) input: unknown) {
    return this.pricing.quote(input as Parameters<typeof this.pricing.quote>[0]);
  }
}
