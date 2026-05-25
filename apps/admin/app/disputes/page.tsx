'use client';

import { useState } from 'react';
import { Shell, card, Btn, pill } from '../ui';

type Reco = 'side_with_host' | 'side_with_cleaner' | 'partial_refund' | 'needs_human_review';
type Decision = 'OPEN' | 'APPROVED' | 'ESCALATED';

interface Dispute {
  id: string;
  property: string;
  summary: string;
  reco: Reco;
  confidence: number;
  decision: Decision;
}

const RECO_LABEL: Record<Reco, string> = {
  side_with_host: '호스트 손',
  side_with_cleaner: '청소사 손',
  partial_refund: '부분 환불',
  needs_human_review: '사람 검토 필요',
};

const initial: Dispute[] = [
  {
    id: 'd-1',
    property: '청담 스카이뷰 #301',
    summary: '호스트가 욕실 청소 미흡을 주장. 체크리스트·사진상 욕실 항목은 완료·촬영됨.',
    reco: 'side_with_cleaner',
    confidence: 0.82,
    decision: 'OPEN',
  },
  {
    id: 'd-2',
    property: '한남 리버하우스',
    summary: '주방 기름때 잔존 주장. 사진 일부만 첨부, 체크리스트 누락 1건.',
    reco: 'partial_refund',
    confidence: 0.61,
    decision: 'OPEN',
  },
];

export default function DisputesPage() {
  const [list, setList] = useState<Dispute[]>(initial);

  function decide(id: string, decision: Decision) {
    setList((prev) => prev.map((d) => (d.id === id ? { ...d, decision } : d)));
  }

  const open = list.filter((d) => d.decision === 'OPEN').length;

  return (
    <Shell title="분쟁 처리" actions={<span style={pill}>열린 분쟁 {open}건</span>}>
      <div style={{ display: 'grid', gap: '1rem' }}>
        {list.map((d) => (
          <div key={d.id} style={card}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
              <strong>{d.property}</strong>
              <span style={{ ...pill, background: '#f5f5f5' }}>
                AI 판정: {RECO_LABEL[d.reco]} · 신뢰도 {(d.confidence * 100).toFixed(0)}%
              </span>
            </div>
            <p style={{ color: '#374151', fontSize: '0.9rem', margin: '0.75rem 0' }}>{d.summary}</p>
            {d.decision === 'OPEN' ? (
              <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                <Btn variant="ghost" onClick={() => decide(d.id, 'ESCALATED')}>사람 검토로 승격</Btn>
                <Btn onClick={() => decide(d.id, 'APPROVED')}>AI 판정 승인</Btn>
              </div>
            ) : (
              <div style={{ textAlign: 'right', color: d.decision === 'APPROVED' ? '#047857' : '#c2410c', fontWeight: 600 }}>
                {d.decision === 'APPROVED' ? 'AI 판정 승인 완료' : '사람 검토로 승격됨'}
              </div>
            )}
          </div>
        ))}
      </div>
    </Shell>
  );
}
