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
import { Btn, ScoreBar, Shell, card, fmtWon, input, label, pill, td, th } from '../../../ui';

// ISO ↔ datetime-local 변환
function isoToLocal(iso?: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}
const localToIso = (v: string) => (v ? new Date(v).toISOString() : null);

function LeadDetail() {
  const id = useSearchParams().get('id');
  const [lead, setLead] = useState<BuyerLeadRow | null>(null);
  const [matches, setMatches] = useState<ListingMatchRow[]>([]);
  const [error, setError] = useState('');
  const [phoneLocal, setPhoneLocal] = useState('');
  const [visitLocal, setVisitLocal] = useState('');
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!id) return;
    api
      .matchesForLead(id)
      .then((r) => {
        setLead(r.lead);
        setMatches(r.matches);
        setPhoneLocal(isoToLocal(r.lead.phoneAt));
        setVisitLocal(isoToLocal(r.lead.visitAt));
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

      {lead ? (
        <div style={{ ...card, marginBottom: '1.25rem' }}>
          <h2 style={{ fontSize: '1rem', marginTop: 0 }}>영업 일정</h2>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
            <div>
              <label style={{ ...label, marginTop: 0 }} htmlFor="phoneAt">📞 전화상담 일시</label>
              <input
                id="phoneAt"
                type="datetime-local"
                style={input}
                value={phoneLocal}
                onChange={(e) => setPhoneLocal(e.target.value)}
              />
            </div>
            <div>
              <label style={{ ...label, marginTop: 0 }} htmlFor="visitAt">🏢 방문 브리핑 일시</label>
              <input
                id="visitAt"
                type="datetime-local"
                style={input}
                value={visitLocal}
                onChange={(e) => setVisitLocal(e.target.value)}
              />
            </div>
          </div>
          <div style={{ marginTop: '0.9rem', display: 'flex', gap: '0.6rem', alignItems: 'center' }}>
            <Btn
              onClick={() => {
                if (!id) return;
                void api
                  .updateLeadSchedule(id, {
                    phoneAt: localToIso(phoneLocal),
                    visitAt: localToIso(visitLocal),
                  })
                  .then(() => {
                    setSaved(true);
                    setTimeout(() => setSaved(false), 2000);
                  })
                  .catch((err) => setError(err instanceof Error ? err.message : '저장 실패'));
              }}
            >
              일정 저장
            </Btn>
            {saved ? <span style={{ color: '#16a34a', fontSize: '0.85rem' }}>저장됨 ✓</span> : null}
          </div>
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
