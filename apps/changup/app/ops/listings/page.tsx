'use client';

// 내부 운영 — 매물 등록/관리.
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import {
  OPERATION_TYPE_LABELS,
  STORE_LISTING_STATUS_LABELS,
  type OperationType,
  type StoreListingStatus,
} from '@hosthelper/shared';
import { api, type StoreListingRow } from '../../api-client';
import { Btn, Shell, card, fmtWon, input, label, pill, td, th } from '../../ui';

const OPERATION_TYPES = Object.keys(OPERATION_TYPE_LABELS) as OperationType[];
const LISTING_STATUSES = Object.keys(STORE_LISTING_STATUS_LABELS) as StoreListingStatus[];

const NEXT_LISTING_STATUS: Record<StoreListingStatus, StoreListingStatus> = {
  ACTIVE: 'RESERVED',
  RESERVED: 'SOLD',
  SOLD: 'ACTIVE',
};

function manToWon(s: string): number {
  const n = Number(s.replace(/[^0-9]/g, ''));
  return Number.isNaN(n) ? 0 : n * 10_000;
}

export default function ListingsPage() {
  const [listings, setListings] = useState<StoreListingRow[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState('');

  // 등록 폼 상태 (만원 단위 입력)
  const [title, setTitle] = useState('');
  const [industry, setIndustry] = useState('');
  const [region, setRegion] = useState('');
  const [operationType, setOperationType] = useState<OperationType>('DIRECT');
  const [depositMan, setDepositMan] = useState('');
  const [rentMan, setRentMan] = useState('');
  const [premiumMan, setPremiumMan] = useState('');
  const [description, setDescription] = useState('');

  const load = useCallback(async () => {
    try {
      setListings(await api.listListings());
      setError('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'API 연결 실패');
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    try {
      await api.createListing({
        title,
        industry,
        region,
        operationType,
        deposit: manToWon(depositMan),
        monthlyRent: manToWon(rentMan),
        premium: manToWon(premiumMan),
        description: description.trim() || undefined,
        status: 'ACTIVE',
      });
      setTitle('');
      setIndustry('');
      setRegion('');
      setDepositMan('');
      setRentMan('');
      setPremiumMan('');
      setDescription('');
      setShowForm(false);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : '등록 실패');
    }
  }

  async function cycleStatus(l: StoreListingRow) {
    await api.updateListing(l.id, { status: NEXT_LISTING_STATUS[l.status] });
    await load();
  }

  return (
    <Shell
      title="매물 관리"
      actions={
        <Btn onClick={() => setShowForm((v) => !v)}>{showForm ? '닫기' : '+ 매물 등록'}</Btn>
      }
    >
      {error ? <p style={{ color: '#dc2626', fontSize: '0.85rem' }}>{error}</p> : null}

      {showForm ? (
        <form onSubmit={create} style={{ ...card, marginBottom: '1.25rem' }}>
          <label style={{ ...label, marginTop: 0 }} htmlFor="title">매물명</label>
          <input id="title" style={input} value={title} onChange={(e) => setTitle(e.target.value)} required maxLength={100} placeholder="예: 홍대입구역 도보 3분 카페" />

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.75rem' }}>
            <div>
              <label style={label} htmlFor="industry">업종</label>
              <input id="industry" style={input} value={industry} onChange={(e) => setIndustry(e.target.value)} required placeholder="카페" />
            </div>
            <div>
              <label style={label} htmlFor="region">지역 (구)</label>
              <input id="region" style={input} value={region} onChange={(e) => setRegion(e.target.value)} required placeholder="마포구" />
            </div>
            <div>
              <label style={label} htmlFor="op">운영방식</label>
              <select id="op" style={input} value={operationType} onChange={(e) => setOperationType(e.target.value as OperationType)}>
                {OPERATION_TYPES.map((o) => (
                  <option key={o} value={o}>{OPERATION_TYPE_LABELS[o]}</option>
                ))}
              </select>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.75rem' }}>
            <div>
              <label style={label} htmlFor="dep">보증금 (만원)</label>
              <input id="dep" style={input} inputMode="numeric" value={depositMan} onChange={(e) => setDepositMan(e.target.value)} required placeholder="3000" />
            </div>
            <div>
              <label style={label} htmlFor="rent">월세 (만원)</label>
              <input id="rent" style={input} inputMode="numeric" value={rentMan} onChange={(e) => setRentMan(e.target.value)} required placeholder="200" />
            </div>
            <div>
              <label style={label} htmlFor="prem">권리금 (만원)</label>
              <input id="prem" style={input} inputMode="numeric" value={premiumMan} onChange={(e) => setPremiumMan(e.target.value)} required placeholder="5000" />
            </div>
          </div>

          <label style={label} htmlFor="desc">설명</label>
          <textarea id="desc" style={{ ...input, minHeight: 70, resize: 'vertical' }} value={description} onChange={(e) => setDescription(e.target.value)} maxLength={5000} />

          <div style={{ marginTop: '1rem' }}>
            <Btn type="submit">등록</Btn>
          </div>
        </form>
      ) : null}

      <div style={{ overflowX: 'auto', background: '#fff', border: '1px solid #ececec', borderRadius: 10 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={th}>매물명</th>
              <th style={th}>업종/지역</th>
              <th style={th}>운영방식</th>
              <th style={th}>보증금</th>
              <th style={th}>월세</th>
              <th style={th}>권리금</th>
              <th style={th}>상태</th>
              <th style={th} />
            </tr>
          </thead>
          <tbody>
            {listings.map((l) => (
              <tr key={l.id}>
                <td style={td}>
                  <Link href={`/ops/listings/detail?id=${l.id}`} style={{ fontWeight: 600 }}>
                    {l.title}
                  </Link>
                </td>
                <td style={td}>{l.industry} / {l.region}</td>
                <td style={td}>{OPERATION_TYPE_LABELS[l.operationType]}</td>
                <td style={td}>{fmtWon(l.deposit)}</td>
                <td style={td}>{fmtWon(l.monthlyRent)}</td>
                <td style={td}>{fmtWon(l.premium)}</td>
                <td style={td}>
                  <span style={pill}>{STORE_LISTING_STATUS_LABELS[l.status]}</span>
                </td>
                <td style={td}>
                  <Btn variant="ghost" onClick={() => void cycleStatus(l)}>
                    → {STORE_LISTING_STATUS_LABELS[NEXT_LISTING_STATUS[l.status]]}
                  </Btn>
                </td>
              </tr>
            ))}
            {listings.length === 0 && !error ? (
              <tr>
                <td style={{ ...td, color: '#9ca3af' }} colSpan={8}>
                  등록된 매물이 없습니다. 우측 상단 &ldquo;+ 매물 등록&rdquo;으로 시작하세요.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </Shell>
  );
}
