'use client';

// 내부 운영 — 리드 파이프라인 (NEW → CONTACTED → MEETING_SET → CLOSED)
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import {
  LEAD_STATUS_LABELS,
  OPERATION_TYPE_LABELS,
  type LeadStatus,
} from '@hosthelper/shared';
import { api, type BuyerLeadRow } from '../../api-client';
import { Btn, Shell, fmtWon, pill, td, th } from '../../ui';

const STATUSES = Object.keys(LEAD_STATUS_LABELS) as LeadStatus[];

const NEXT_STATUS: Partial<Record<LeadStatus, LeadStatus>> = {
  NEW: 'CONTACTED',
  CONTACTED: 'MEETING_SET',
  MEETING_SET: 'CLOSED',
};

function criteriaSummary(l: BuyerLeadRow): string {
  const parts = [
    l.industries.length ? l.industries.join('·') : '업종 무관',
    l.regions.length ? l.regions.join('·') : '지역 무관',
    `보증금 ${fmtWon(l.depositMax)} / 월세 ${fmtWon(l.rentMax)} / 권리금 ${fmtWon(l.premiumMax)}`,
  ];
  return parts.join(' · ');
}

export default function LeadsPage() {
  const [filter, setFilter] = useState<LeadStatus | 'ALL'>('ALL');
  const [leads, setLeads] = useState<BuyerLeadRow[]>([]);
  const [error, setError] = useState('');

  const load = useCallback(async (f: LeadStatus | 'ALL') => {
    try {
      setLeads(await api.listLeads(f === 'ALL' ? undefined : f));
      setError('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'API 연결 실패');
    }
  }, []);

  useEffect(() => {
    void load(filter);
  }, [filter, load]);

  async function advance(l: BuyerLeadRow) {
    const next = NEXT_STATUS[l.status];
    if (!next) return;
    await api.updateLeadStatus(l.id, next);
    await load(filter);
  }

  return (
    <Shell title="리드 파이프라인">
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
        {(['ALL', ...STATUSES] as const).map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setFilter(s)}
            style={{
              ...pill,
              cursor: 'pointer',
              background: filter === s ? '#0a0a0a' : '#fff',
              color: filter === s ? '#fff' : '#374151',
            }}
          >
            {s === 'ALL' ? '전체' : LEAD_STATUS_LABELS[s]}
          </button>
        ))}
      </div>

      {error ? <p style={{ color: '#dc2626', fontSize: '0.85rem' }}>{error}</p> : null}

      <div style={{ overflowX: 'auto', background: '#fff', border: '1px solid #ececec', borderRadius: 10 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={th}>이름</th>
              <th style={th}>연락처</th>
              <th style={th}>운영방식</th>
              <th style={th}>희망 조건</th>
              <th style={th}>상태</th>
              <th style={th} />
            </tr>
          </thead>
          <tbody>
            {leads.map((l) => (
              <tr key={l.id}>
                <td style={td}>
                  <Link href={`/ops/leads/detail?id=${l.id}`} style={{ fontWeight: 600 }}>
                    {l.name}
                  </Link>
                </td>
                <td style={td}>{l.phone}</td>
                <td style={td}>
                  {l.operationTypes.map((o) => OPERATION_TYPE_LABELS[o]).join('·') || '무관'}
                </td>
                <td style={{ ...td, color: '#6b7280', fontSize: '0.82rem' }}>
                  {criteriaSummary(l)}
                </td>
                <td style={td}>
                  <span style={pill}>{LEAD_STATUS_LABELS[l.status]}</span>
                </td>
                <td style={td}>
                  {NEXT_STATUS[l.status] ? (
                    <Btn variant="ghost" onClick={() => void advance(l)}>
                      → {LEAD_STATUS_LABELS[NEXT_STATUS[l.status]!]}
                    </Btn>
                  ) : null}
                </td>
              </tr>
            ))}
            {leads.length === 0 && !error ? (
              <tr>
                <td style={{ ...td, color: '#9ca3af' }} colSpan={6}>
                  아직 리드가 없습니다. 설문(/s)을 SNS에 공유해보세요.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </Shell>
  );
}
