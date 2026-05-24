'use client';

import { useEffect, useRef, useState } from 'react';
import {
  DEMO,
  startDemoStream,
  type KpiSnapshot,
  type PlatformEvent,
  type PlatformEventType,
} from './demo';

const TYPE_LABEL: Record<PlatformEventType, string> = {
  'booking.created': '예약',
  'payment.confirmed': '결제',
  'match.candidates_computed': '후보 산출',
  'offer.created': '오퍼 발송',
  'offer.accepted': '오퍼 수락',
  'offer.declined': '오퍼 거절',
  'job.matched': '매칭 완료',
  'dispute.triaged': '분쟁',
};

const MAX_FEED = 80;

export default function AdminLive() {
  const [kpi, setKpi] = useState<KpiSnapshot | null>(null);
  const [feed, setFeed] = useState<PlatformEvent[]>([]);
  const [alerts, setAlerts] = useState<PlatformEvent[]>([]);
  const [connected, setConnected] = useState(false);
  const esRef = useRef<EventSource | null>(null);

  useEffect(() => {
    if (DEMO) {
      setConnected(true);
      return startDemoStream({
        onSnapshot: setKpi,
        onEvent: (event) => {
          setFeed((prev) => [event, ...prev].slice(0, MAX_FEED));
          if (event.type === 'dispute.triaged') {
            setAlerts((prev) => [event, ...prev].slice(0, 20));
          }
        },
      });
    }

    const api = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:4000';
    const es = new EventSource(`${api}/api/events/stream`);
    esRef.current = es;

    es.onopen = () => setConnected(true);
    es.onerror = () => setConnected(false);

    es.addEventListener('snapshot', (e) => {
      try {
        setKpi(JSON.parse((e as MessageEvent).data) as KpiSnapshot);
      } catch {
        /* ignore */
      }
    });

    es.addEventListener('platform', (e) => {
      try {
        const event = JSON.parse((e as MessageEvent).data) as PlatformEvent;
        setFeed((prev) => [event, ...prev].slice(0, MAX_FEED));
        if (event.type === 'dispute.triaged') {
          setAlerts((prev) => [event, ...prev].slice(0, 20));
        }
      } catch {
        /* ignore */
      }
    });

    return () => es.close();
  }, []);

  return (
    <main>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1 style={{ margin: 0 }}>실시간 운영 모니터링</h1>
        <span style={{ ...pill, background: connected ? '#047857' : '#c2410c', color: '#fff' }}>
          {DEMO ? '데모 스트림' : connected ? '실시간 연결됨' : '연결 끊김'}
        </span>
      </header>
      <p style={{ color: '#6b7280', marginTop: '0.25rem' }}>
        <a href="/" style={{ color: '#6b7280' }}>← 운영자 콘솔</a>
      </p>

      <section style={kpiGrid}>
        <KpiCard label="진행 중 잡" value={kpi?.activeJobs} />
        <KpiCard label="대기 오퍼" value={kpi?.pendingOffers} />
        <KpiCard label="오늘 예약" value={kpi?.todayBookings} />
        <KpiCard label="오늘 거래액" value={kpi ? `₩${kpi.todayGmv.toLocaleString()}` : undefined} />
        <KpiCard label="열린 분쟁" value={kpi?.openDisputes} warn={!!kpi && kpi.openDisputes > 0} />
      </section>

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '1.5rem', marginTop: '1.5rem' }}>
        <section>
          <h2 style={h2}>매칭 활동</h2>
          <div style={card}>
            {feed.length === 0 ? (
              <Empty text="실시간 활동 대기 중… 예약·결제·매칭 발생 시 표시됩니다." />
            ) : (
              feed.map((event) => (
                <Row key={event.id} left={event.title} type={event.type} at={event.at} />
              ))
            )}
          </div>
        </section>

        <section>
          <h2 style={h2}>분쟁 / 알림</h2>
          <div style={card}>
            {alerts.length === 0 ? (
              <Empty text="알림 없음" />
            ) : (
              alerts.map((a) => <Row key={a.id} left={a.title} type={a.type} at={a.at} />)
            )}
          </div>
        </section>
      </div>
    </main>
  );
}

function KpiCard({ label, value, warn }: { label: string; value?: number | string; warn?: boolean }) {
  return (
    <div style={card}>
      <div style={{ color: '#6b7280', fontSize: '0.85rem' }}>{label}</div>
      <div style={{ fontSize: '1.6rem', fontWeight: 700, marginTop: '0.25rem', color: warn ? '#c2410c' : '#0a0a0a' }}>
        {value ?? '—'}
      </div>
    </div>
  );
}

function Row({ left, type, at }: { left: string; type: PlatformEventType; at: string }) {
  return (
    <div style={row}>
      <div>
        <div>{left}</div>
        <div style={{ color: '#6b7280', fontSize: '0.8rem' }}>{new Date(at).toLocaleTimeString('ko-KR')}</div>
      </div>
      <span style={pill}>{TYPE_LABEL[type]}</span>
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return <div style={{ color: '#6b7280', padding: '0.5rem 0' }}>{text}</div>;
}

const card: React.CSSProperties = {
  border: '1px solid #ececec',
  borderRadius: 10,
  padding: '1rem',
  background: '#fff',
};
const kpiGrid: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
  gap: '0.75rem',
  marginTop: '1.5rem',
};
const row: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  padding: '0.6rem 0',
  borderBottom: '1px solid #f3f4f6',
};
const pill: React.CSSProperties = {
  fontSize: '0.75rem',
  padding: '0.15rem 0.5rem',
  border: '1px solid #ececec',
  borderRadius: 999,
  whiteSpace: 'nowrap',
};
const h2: React.CSSProperties = { fontSize: '1rem', marginBottom: '0.5rem' };
