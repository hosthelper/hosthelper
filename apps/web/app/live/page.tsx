'use client';

import { useEffect, useRef, useState } from 'react';
import { Wrap, Section, Card, ListItem, Badge } from '@hosthelper/ui';
import {
  SSE_EVENT_PLATFORM,
  SSE_EVENT_SNAPSHOT,
  type KpiSnapshot,
  type PlatformEvent,
} from '@hosthelper/shared';
import { DEMO } from '../demo';
import { startDemoStream } from './demo';

const TYPE_LABEL: Record<PlatformEvent['type'], string> = {
  'booking.created': '예약',
  'payment.confirmed': '결제',
  'match.candidates_computed': '후보 산출',
  'offer.created': '오퍼 발송',
  'offer.accepted': '오퍼 수락',
  'offer.declined': '오퍼 거절',
  'job.matched': '매칭 완료',
  'job.started': '작업 시작',
  'job.submitted': '완료 제출',
  'job.approved': '작업 승인',
  'payout.scheduled': '정산 예약',
  'dispute.triaged': '분쟁',
};

function toneFor(type: PlatformEvent['type']): 'live' | 'warn' | undefined {
  if (
    type === 'offer.accepted' ||
    type === 'job.matched' ||
    type === 'payment.confirmed' ||
    type === 'job.approved' ||
    type === 'payout.scheduled'
  )
    return 'live';
  if (type === 'offer.declined' || type === 'dispute.triaged') return 'warn';
  return undefined;
}

const MAX_FEED = 50;

export default function LivePage() {
  const [kpi, setKpi] = useState<KpiSnapshot | null>(null);
  const [feed, setFeed] = useState<PlatformEvent[]>([]);
  const [connected, setConnected] = useState(false);
  const esRef = useRef<EventSource | null>(null);

  useEffect(() => {
    if (DEMO) {
      setConnected(true);
      return startDemoStream({
        onSnapshot: setKpi,
        onEvent: (event) => setFeed((prev) => [event, ...prev].slice(0, MAX_FEED)),
      });
    }

    const api = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:4000';
    const es = new EventSource(`${api}/api/events/stream`);
    esRef.current = es;

    es.onopen = () => setConnected(true);
    es.onerror = () => setConnected(false);

    es.addEventListener(SSE_EVENT_SNAPSHOT, (e) => {
      try {
        setKpi(JSON.parse((e as MessageEvent).data) as KpiSnapshot);
      } catch {
        /* ignore */
      }
    });

    es.addEventListener(SSE_EVENT_PLATFORM, (e) => {
      try {
        const event = JSON.parse((e as MessageEvent).data) as PlatformEvent;
        setFeed((prev) => [event, ...prev].slice(0, MAX_FEED));
      } catch {
        /* ignore */
      }
    });

    return () => es.close();
  }, []);

  return (
    <Wrap>
      <Section title="실시간 현황" />
      <p className="hh-list-item__meta" style={{ marginTop: '-0.5rem' }}>
        <Badge tone={connected ? 'live' : 'warn'}>
          {DEMO ? '데모 스트림' : connected ? '실시간 연결됨' : '연결 끊김'}
        </Badge>
      </p>

      <div className="hh-row" style={{ flexWrap: 'wrap', gap: '0.75rem' }}>
        <Kpi label="진행 중 잡" value={kpi?.activeJobs} />
        <Kpi label="대기 오퍼" value={kpi?.pendingOffers} />
        <Kpi label="오늘 예약" value={kpi?.todayBookings} />
        <Kpi label="오늘 거래액" value={kpi ? `₩${kpi.todayGmv.toLocaleString()}` : undefined} />
        <Kpi label="열린 분쟁" value={kpi?.openDisputes} tone={kpi && kpi.openDisputes > 0 ? 'warn' : undefined} />
      </div>

      <div style={{ marginTop: '1.25rem' }}>
        <Section title="실시간 활동" />
        <Card>
          {feed.length === 0 ? (
            <div className="hh-list-item__meta" style={{ padding: '0.5rem 0' }}>
              아직 활동이 없습니다. 새 예약·결제·매칭이 발생하면 여기에 실시간으로 표시됩니다.
            </div>
          ) : (
            feed.map((event) => (
              <ListItem
                key={event.id}
                left={
                  <>
                    <div>{event.title}</div>
                    <div className="hh-list-item__meta">
                      {new Date(event.at).toLocaleTimeString('ko-KR')}
                    </div>
                  </>
                }
                right={<Badge tone={toneFor(event.type)}>{TYPE_LABEL[event.type]}</Badge>}
              />
            ))
          )}
        </Card>
      </div>
    </Wrap>
  );
}

function Kpi({
  label,
  value,
  tone,
}: {
  label: string;
  value?: number | string;
  tone?: 'warn';
}) {
  return (
    <div style={{ flex: '1 1 120px', minWidth: 120 }}>
      <Card>
        <div className="hh-list-item__meta">{label}</div>
        <div
          style={{
            fontSize: '1.5rem',
            fontWeight: 700,
            marginTop: '0.25rem',
            color: tone === 'warn' ? 'var(--hh-warn)' : 'var(--hh-fg)',
          }}
        >
          {value ?? '—'}
        </div>
      </Card>
    </div>
  );
}
