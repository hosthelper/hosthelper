import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import type { BuyerLead, PrismaClient, StoreListing } from '@hosthelper/db';
import {
  DEFAULT_CHANGUP_WEIGHTS,
  type BuyerLeadSurvey,
  type LeadStatus,
  type StoreListingStatus,
  type StoreListingUpsert,
} from '@hosthelper/shared';
import { PRISMA } from '../prisma/prisma.module';
import { rankListings, scoreListing, type LeadCriteria, type ListingSnapshot } from './scoring';

function toCriteria(lead: BuyerLead): LeadCriteria {
  return {
    operationTypes: lead.operationTypes,
    industries: lead.industries,
    regions: lead.regions,
    depositMax: lead.depositMax,
    rentMax: lead.rentMax,
    premiumMax: lead.premiumMax,
  };
}

function toSnapshot(l: StoreListing): ListingSnapshot {
  return {
    id: l.id,
    industry: l.industry,
    region: l.region,
    operationType: l.operationType,
    deposit: l.deposit,
    monthlyRent: l.monthlyRent,
    premium: l.premium,
  };
}

@Injectable()
export class ChangupService {
  constructor(@Inject(PRISMA) private readonly prisma: PrismaClient) {}

  // ---------- 리드 (예비창업자 설문) ----------

  async createLead(input: BuyerLeadSurvey) {
    // 허니팟: 봇이 채운 제출은 성공 응답만 주고 저장하지 않는다.
    if (input.website) return { ok: true as const };
    const { website: _website, ...data } = input;
    const lead = await this.prisma.buyerLead.create({ data });
    return { ok: true as const, id: lead.id };
  }

  listLeads(status?: LeadStatus) {
    return this.prisma.buyerLead.findMany({
      where: status ? { status } : undefined,
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
  }

  async getLead(id: string) {
    const lead = await this.prisma.buyerLead.findUnique({ where: { id } });
    if (!lead) throw new NotFoundException(`Lead ${id} not found`);
    return lead;
  }

  async updateLeadStatus(id: string, status: LeadStatus) {
    await this.getLead(id);
    return this.prisma.buyerLead.update({ where: { id }, data: { status } });
  }

  // 리드 → ACTIVE 매물 랭킹 (조회 시 계산, ADR-0003)
  async matchesForLead(id: string) {
    const lead = await this.getLead(id);
    const listings = await this.prisma.storeListing.findMany({
      where: { status: 'ACTIVE' },
      take: 500,
    });
    const byId = new Map(listings.map((l) => [l.id, l]));
    const matches = rankListings(
      toCriteria(lead),
      listings.map(toSnapshot),
      DEFAULT_CHANGUP_WEIGHTS,
    ).map((m) => ({ ...m, listing: byId.get(m.listingId)! }));
    return { lead, matches };
  }

  // ---------- 매물 ----------

  createListing(input: StoreListingUpsert): Promise<StoreListing> {
    return this.prisma.storeListing.create({ data: input });
  }

  async updateListing(id: string, input: Partial<StoreListingUpsert>) {
    await this.getListing(id);
    return this.prisma.storeListing.update({ where: { id }, data: input });
  }

  listListings(status?: StoreListingStatus) {
    return this.prisma.storeListing.findMany({
      where: status ? { status } : undefined,
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
  }

  async getListing(id: string) {
    const listing = await this.prisma.storeListing.findUnique({ where: { id } });
    if (!listing) throw new NotFoundException(`Listing ${id} not found`);
    return listing;
  }

  // 역방향: 매물 → 진행 중(CLOSED 제외) 리드 랭킹
  async matchesForListing(id: string) {
    const listing = await this.getListing(id);
    const leads = await this.prisma.buyerLead.findMany({
      where: { status: { not: 'CLOSED' } },
      take: 500,
    });
    const snapshot = toSnapshot(listing);
    const matches = leads
      .map((lead) => {
        const s = scoreListing(toCriteria(lead), snapshot, DEFAULT_CHANGUP_WEIGHTS);
        return s ? { ...s, lead } : null;
      })
      .filter((m): m is NonNullable<typeof m> => m !== null)
      .sort((a, b) => b.score - a.score)
      .slice(0, DEFAULT_CHANGUP_WEIGHTS.topN);
    return { listing, matches };
  }
}
