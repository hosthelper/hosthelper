'use client';

// 리드 상세 + 조건에 맞는 매물 랭킹 (조회 시 계산).
// 정적 export 호환을 위해 동적 세그먼트 대신 ?id= 쿼리를 쓴다.
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';
import {
  CONTACT_CHANNEL_LABELS,
  LEAD_STATUS_LABELS,
  OPERATION_TYPE_LABELS,
} from '@hosthelper/shared';
import { api, type BuyerLeadRow, type ListingMatchRow } from '../../../api-client';
import { ScoreBar, Shell, card, fmtWon, pill, td, th } from '../../../ui';

function LeadDetail() {
  const id = useSearchParams().get('id');
  const [lead, setLead] = useState<BuyerLeadRow | null>(null);
  const [matches, setMatches] = useState<ListingMatchRow[]>([]);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!id) return;
    api
      .matchesForLead(id)
      .then((r) => {
        setLead(r.lead);
        setMatches(r.matches);
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'API 연결 실패'));
  }, [id]);

  if (!id) return <Shell title="리드 상세">잘못된 접근입니다 (id 없음).</Shell>;

  return (
    <Shell title={lead ? `${lead.name} 님` : '리드 상세'}>
      {error ? <p style={{ color: '#dc2626', fontSize: '0.85rem' }}>{error}</p> : null}

      {lead ? (
        <div style={{ ...card, marginBottom: '1.25rem' }}>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.75rem' }}>
            <span style={pill}>{LEAD_STATUS_LABELS[lead.status]}</span>
            <span style={pill}>
              {lead.phone} ({CONTACT_CHANNEL_LABELS[lead.contactChannel]})
            </span>
          </div>
          <dl style={{ margin: 0, fontSize: '0.9rem', lineHeight: 1.9 }}>
            <div>
              <b>운영방식</b>:{' '}
              {lead.operationTypes.map((o) => OPERATION_TYPE_LABELS[o]).join(', ') || '무관'}
            </div>
            <div>
              <b>업종</b>: {lead.industries.join(', ') || '무관'} · <b>지역</b>:{' '}
              {lead.regions.join(', ') || '무관'}
            </div>
            <div>
              <b>보증금</b> {fmtWon(lead.depositMax)} · <b>월세</b> {fmtWon(lead.rentMax)} ·{' '}
              <b>권리금</b> {fmtWon(lead.premiumMax)}
            </div>
            {lead.notes ? <div style={{ color: '#6b7280' }}>메모: {lead.notes}</div> : null}
          </dl>
        </div>
      ) : null}

      <h2 style={{ fontSize: '1.05rem' }}>추천 매물 {matches.length}건</h2>
      <div style={{ overflowX: 'auto', background: '#fff', border: '1px solid #ececec', borderRadius: 10 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={th}>매물</th>
              <th style={th}>업종/지역</th>
              <th style={th}>조건</th>
              <th style={th}>종합 점수</th>
              <th style={th}>업종</th>
              <th style={th}>지역</th>
              <th style={th}>운영</th>
              <th style={th}>예산</th>
            </tr>
          </thead>
          <tbody>
            {matches.map((m) => (
              <tr key={m.listingId}>
                <td style={td}>
                  <Link href={`/ops/listings/detail?id=${m.listing.id}`} style={{ fontWeight: 600 }}>
                    {m.listing.title}
                  </Link>
                  <div style={{ color: '#9ca3af', fontSize: '0.75rem' }}>
                    {OPERATION_TYPE_LABELS[m.listing.operationType]}
                  </div>
                </td>
                <td style={td}>
                  {m.listing.industry} / {m.listing.region}
                </td>
                <td style={{ ...td, fontSize: '0.82rem', color: '#6b7280' }}>
                  보 {fmtWon(m.listing.deposit)} · 월 {fmtWon(m.listing.monthlyRent)} · 권{' '}
                  {fmtWon(m.listing.premium)}
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
                  조건에 맞는 판매중 매물이 없습니다.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </Shell>
  );
}

export default function LeadDetailPage() {
  return (
    <Suspense>
      <LeadDetail />
    </Suspense>
  );
}
