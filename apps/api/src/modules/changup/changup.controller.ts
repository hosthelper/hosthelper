import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import {
  BuyerLeadSurveySchema,
  LeadStatusSchema,
  LeadStatusUpdateSchema,
  StoreListingStatusSchema,
  StoreListingUpsertSchema,
  type BuyerLeadSurvey,
  type LeadStatusUpdate,
  type StoreListingUpsert,
} from '@hosthelper/shared';
import { ChangupService } from './changup.service';
import { ZodPipe } from '../../common/zod.pipe';

@ApiTags('changup')
@Controller('changup')
export class ChangupController {
  constructor(private readonly changup: ChangupService) {}

  // 공개 설문 제출 (인증 없음 — 허니팟으로 봇 완화, ADR-0003)
  @Post('leads')
  createLead(@Body(new ZodPipe(BuyerLeadSurveySchema)) input: BuyerLeadSurvey) {
    return this.changup.createLead(input);
  }

  @Get('leads')
  listLeads(@Query('status', new ZodPipe(LeadStatusSchema.optional())) status?: never) {
    return this.changup.listLeads(status);
  }

  @Get('leads/:id')
  getLead(@Param('id') id: string) {
    return this.changup.getLead(id);
  }

  @Patch('leads/:id/status')
  updateLeadStatus(
    @Param('id') id: string,
    @Body(new ZodPipe(LeadStatusUpdateSchema)) body: LeadStatusUpdate,
  ) {
    return this.changup.updateLeadStatus(id, body.status);
  }

  @Get('leads/:id/matches')
  matchesForLead(@Param('id') id: string) {
    return this.changup.matchesForLead(id);
  }

  @Post('listings')
  async createListing(@Body(new ZodPipe(StoreListingUpsertSchema)) input: StoreListingUpsert) {
    return await this.changup.createListing(input);
  }

  @Get('listings')
  listListings(
    @Query('status', new ZodPipe(StoreListingStatusSchema.optional())) status?: never,
  ) {
    return this.changup.listListings(status);
  }

  @Get('listings/:id')
  getListing(@Param('id') id: string) {
    return this.changup.getListing(id);
  }

  @Patch('listings/:id')
  updateListing(
    @Param('id') id: string,
    @Body(new ZodPipe(StoreListingUpsertSchema.partial())) input: Partial<StoreListingUpsert>,
  ) {
    return this.changup.updateListing(id, input);
  }

  @Get('listings/:id/matches')
  matchesForListing(@Param('id') id: string) {
    return this.changup.matchesForListing(id);
  }
}
