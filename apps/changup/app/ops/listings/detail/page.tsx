'use client';

// 매물 상세 + 역방향 매칭: 이 매물을 원할 만한 리드 랭킹.
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';
import {
  LEAD_STATUS_LABELS,
  OPERATION_TYPE_LABELS,
  STORE_LISTING_STATUS_LABELS,
} from '@hosthelper/shared';
import { api, type LeadMatchRow, type StoreListingRow } from '../../../api-client';
import { ScoreBar, Shell, card, fmtWon, pill, td, th } from '../../../ui';

function ListingDetail() {
  const id = useSearchParams().get('id');
  const [listing, setListing] = useState<StoreListingRow | null>(null);
  const [matches, setMatches] = useState<LeadMatchRow[]>([]);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!id) return;
    api
      .matchesForListing(id)
      .then((r) => {
        setListing(r.listing);
        setMatches(r.matches);
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'API 연결 실패'));
  }, [id]);

  if (!id) return <Shell title="매물 상세">잘못된 접근입니다 (id 없음).</Shell>;

  return (
    <Shell title={listing ? listing.title : '매물 상세'}>
      {error ? <p style={{ color: '#dc2626', fontSize: '0.85rem' }}>{error}</p> : null}

      {listing ? (
        <div style={{ ...card, marginBottom: '1.25rem' }}>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.75rem' }}>
            <span style={pill}>{STORE_LISTING_STATUS_LABELS[listing.status]}</span>
            <span style={pill}>{OPERATION_TYPE_LABELS[listing.operationType]}</span>
            <span style={pill}>
              {listing.industry} / {listing.region}
            </span>
          </div>
          <div style={{ fontSize: '0.9rem', lineHeight: 1.9 }}>
            <b>보증금</b> {fmtWon(listing.deposit)} · <b>월세</b> {fmtWon(listing.monthlyRent)} ·{' '}
            <b>권리금</b> {fmtWon(listing.premium)}
          </div>
          {listing.description ? (
            <p style={{ color: '#6b7280', fontSize: '0.9rem', whiteSpace: 'pre-wrap' }}>
              {listing.description}
            </p>
          ) : null}
        </div>
      ) : null}

      <h2 style={{ fontSize: '1.05rem' }}>이 매물을 원할 만한 리드 {matches.length}명</h2>
      <div style={{ overflowX: 'auto', background: '#fff', border: '1px solid #ececec', borderRadius: 10 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={th}>이름</th>
              <th style={th}>연락처</th>
              <th style={th}>상태</th>
              <th style={th}>종합 점수</th>
              <th style={th}>업종</th>
              <th style={th}>지역</th>
              <th style={th}>운영</th>
              <th style={th}>예산</th>
            </tr>
          </thead>
          <tbody>
            {matches.map((m) => (
              <tr key={m.lead.id}>
                <td style={td}>
                  <Link href={`/ops/leads/detail?id=${m.lead.id}`} style={{ fontWeight: 600 }}>
                    {m.lead.name}
                  </Link>
                </td>
                <td style={td}>{m.lead.phone}</td>
                <td style={td}>
                  <span style={pill}>{LEAD_STATUS_LABELS[m.lead.status]}</span>
                </td>
                <td style={td}>
                  <ScoreBar value={m.score} />
                </td>
                <td style={td}>
                  <ScoreBar value={m.industryScore} />
                </td>
                <td style={td}>
                  <ScoreBar value={m.regionScore} />
                </td>
                <td style={td}>
                  <ScoreBar value={m.operationScore} />
                </td>
                <td style={td}>
                  <ScoreBar value={m.budgetScore} />
                </td>
              </tr>
            ))}
            {matches.length === 0 && !error ? (
              <tr>
                <td style={{ ...td, color: '#9ca3af' }} colSpan={8}>
                  조건이 맞는 진행 중 리드가 없습니다.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </Shell>
  );
}

export default function ListingDetailPage() {
  return (
    <Suspense>
      <ListingDetail />
    </Suspense>
  );
}
