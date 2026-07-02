import { Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { OfferService, type PendingOffer } from './offer.service';

@ApiTags('offers')
@Controller('offers')
export class OfferController {
  constructor(private readonly offers: OfferService) {}

  @Get()
  async listPending(
    @Query('cleanerId') cleanerId: string,
  ): Promise<{ cleanerId: string; offers: PendingOffer[] }> {
    const offers = await this.offers.listPending(cleanerId);
    return { cleanerId, offers };
  }

  @Post(':offerId/accept')
  async accept(@Param('offerId') offerId: string) {
    return this.offers.accept(offerId);
  }

  @Post(':offerId/decline')
  async decline(@Param('offerId') offerId: string) {
    return this.offers.decline(offerId);
  }
}
