'use client';

// 영업 일정 캘린더: 전화상담 📞 / 회사 방문(매물 브리핑) 🏢 예약을 날짜별로 표시.
// 플로우: 설문 → 전화미팅 예약 → 전화상담 → 오프미팅 예약 → 회사 유입 → 매물 브리핑
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { LEAD_STATUS_LABELS } from '@hosthelper/shared';
import { api, type ScheduleItem } from '../../api-client';
import { Shell, card, pill, td, th } from '../../ui';

const KIND_LABEL = { PHONE_CALL: '📞 전화상담', OFFICE_VISIT: '🏢 방문 브리핑' } as const;

function dayLabel(iso: string): string {
  const d = new Date(iso);
  const today = new Date();
  const diff = Math.floor(
    (new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime() -
      new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime()) /
      86400000,
  );
  const base = d.toLocaleDateString('ko-KR', { month: 'long', day: 'numeric', weekday: 'short' });
  if (diff === 0) return `오늘 · ${base}`;
  if (diff === 1) return `내일 · ${base}`;
  if (diff < 0) return `지남 · ${base}`;
  return base;
}

function timeLabel(iso: string): string {
  return new Date(iso).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });
}

export default function CalendarPage() {
  const [items, setItems] = useState<ScheduleItem[]>([]);
  const [error, setError] = useState('');

  useEffect(() => {
    api
      .getSchedule(14)
      .then(setItems)
      .catch((err) => setError(err instanceof Error ? err.message : 'API 연결 실패'));
  }, []);

  // 날짜별 그룹
  const groups = new Map<string, ScheduleItem[]>();
  for (const it of items) {
    const key = new Date(it.at).toDateString();
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(it);
  }

  return (
    <Shell title="영업 일정 (14일)">
      {error ? <p style={{ color: '#dc2626', fontSize: '0.85rem' }}>{error}</p> : null}
      {items.length === 0 && !error ? (
        <div style={card}>
          <p style={{ color: '#9ca3af', margin: 0 }}>
            예정된 일정이 없습니다. 리드 상세 화면에서 전화상담·방문 일정을 등록하세요.
          </p>
        </div>
      ) : null}
      {[...groups.entries()].map(([key, dayItems]) => (
        <div key={key} style={{ marginBottom: '1.25rem' }}>
          <h2 style={{ fontSize: '0.95rem', color: '#374151' }}>{dayLabel(dayItems[0]!.at)}</h2>
          <div style={{ overflowX: 'auto', background: '#fff', border: '1px solid #ececec', borderRadius: 10 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={th}>시간</th>
                  <th style={th}>구분</th>
                  <th style={th}>이름</th>
                  <th style={th}>연락처</th>
                  <th style={th}>상태</th>
                </tr>
              </thead>
              <tbody>
                {dayItems.map((it) => (
                  <tr key={`${it.lead.id}-${it.kind}`}>
                    <td style={{ ...td, fontWeight: 600 }}>{timeLabel(it.at)}</td>
                    <td style={td}>{KIND_LABEL[it.kind]}</td>
                    <td style={td}>
                      <Link href={`/ops/leads/detail?id=${it.lead.id}`} style={{ fontWeight: 600 }}>
                        {it.lead.name}
                      </Link>
                    </td>
                    <td style={td}>
                      <a href={`tel:${it.lead.phone}`}>{it.lead.phone}</a>
                    </td>
                    <td style={td}>
                      <span style={pill}>{LEAD_STATUS_LABELS[it.lead.status]}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}
    </Shell>
  );
}
