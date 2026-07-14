// 창업이지 API 클라이언트 — 저장소 최초의 API 실연결 프론트엔드.
// fetch는 전부 이 파일을 통해서만 나간다.
import type {
  BuyerLeadSurvey,
  ContactChannel,
  LeadStatus,
  ListingMatchScore,
  OperationType,
  StoreListingStatus,
  StoreListingUpsert,
} from '@hosthelper/shared';

export const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:4000';

export interface StoreListingRow extends Omit<StoreListingUpsert, 'description'> {
  id: string;
  description?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface BuyerLeadRow {
  id: string;
  name: string;
  phone: string;
  contactChannel: ContactChannel;
  operationTypes: OperationType[];
  industries: string[];
  regions: string[];
  depositMax: number | null;
  rentMax: number | null;
  premiumMax: number | null;
  notes?: string | null;
  status: LeadStatus;
  createdAt: string;
  updatedAt: string;
}

export type ListingMatchRow = ListingMatchScore & { listing: StoreListingRow };
export type LeadMatchRow = ListingMatchScore & { lead: BuyerLeadRow };

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}/api${path}`, {
    headers: { 'Content-Type': 'application/json' },
    cache: 'no-store',
    ...init,
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`API ${res.status}: ${body.slice(0, 300)}`);
  }
  return (await res.json()) as T;
}

const get = <T>(p: string) => request<T>(p);
const post = <T>(p: string, body: unknown) =>
  request<T>(p, { method: 'POST', body: JSON.stringify(body) });
const patch = <T>(p: string, body: unknown) =>
  request<T>(p, { method: 'PATCH', body: JSON.stringify(body) });

// 설문 접수만 별도 엔드포인트로 보낼 수 있다 (예: Supabase Edge Function).
// 미설정 시 기본 API(/api/changup/leads) 사용.
const LEADS_ENDPOINT = process.env.NEXT_PUBLIC_LEADS_ENDPOINT;

export const api = {
  submitSurvey: async (input: BuyerLeadSurvey) => {
    if (LEADS_ENDPOINT) {
      const res = await fetch(LEADS_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      });
      if (!res.ok) throw new Error(`API ${res.status}: ${(await res.text()).slice(0, 300)}`);
      return (await res.json()) as { ok: true; id?: string };
    }
    return post<{ ok: true; id?: string }>('/changup/leads', input);
  },
  listLeads: (status?: LeadStatus) =>
    get<BuyerLeadRow[]>(`/changup/leads${status ? `?status=${status}` : ''}`),
  getLead: (id: string) => get<BuyerLeadRow>(`/changup/leads/${id}`),
  updateLeadStatus: (id: string, status: LeadStatus) =>
    patch<BuyerLeadRow>(`/changup/leads/${id}/status`, { status }),
  matchesForLead: (id: string) =>
    get<{ lead: BuyerLeadRow; matches: ListingMatchRow[] }>(`/changup/leads/${id}/matches`),
  listListings: (status?: StoreListingStatus) =>
    get<StoreListingRow[]>(`/changup/listings${status ? `?status=${status}` : ''}`),
  getListing: (id: string) => get<StoreListingRow>(`/changup/listings/${id}`),
  createListing: (input: StoreListingUpsert) =>
    post<StoreListingRow>('/changup/listings', input),
  updateListing: (id: string, input: Partial<StoreListingUpsert>) =>
    patch<StoreListingRow>(`/changup/listings/${id}`, input),
  matchesForListing: (id: string) =>
    get<{ listing: StoreListingRow; matches: LeadMatchRow[] }>(
      `/changup/listings/${id}/matches`,
    ),
};
