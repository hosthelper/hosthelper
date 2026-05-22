'use client';

import { useState } from 'react';
import Link from 'next/link';

interface Quote {
  total: number;
  platformFee: number;
  cleanerPayout: number;
}

export default function BookPage() {
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [pyeong, setPyeong] = useState(22);
  const [bedrooms, setBedrooms] = useState(2);
  const [quote, setQuote] = useState<Quote | null>(null);
  const [loading, setLoading] = useState(false);

  const api = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:4000';

  async function getQuote() {
    if (!start || !end) return;
    setLoading(true);
    try {
      const res = await fetch(`${api}/api/pricing/quote`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          pyeong,
          bedrooms,
          cleaningStartAt: new Date(start).toISOString(),
          cleaningEndAt: new Date(end).toISOString(),
        }),
      });
      if (res.ok) setQuote((await res.json()) as Quote);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="wrap">
      <nav className="nav">
        <span className="logo">hosthelper</span>
        <Link href="/host" className="login">취소</Link>
      </nav>

      <section style={{ padding: '2.5rem 0 1rem' }}>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 700 }}>청소 예약</h1>
      </section>

      <div className="card">
        <div className="field">
          <label htmlFor="start">시작 시각</label>
          <input id="start" type="datetime-local" value={start} onChange={(e) => setStart(e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="end">종료 시각</label>
          <input id="end" type="datetime-local" value={end} onChange={(e) => setEnd(e.target.value)} />
        </div>
        <div className="row">
          <div className="field">
            <label htmlFor="pyeong">평수</label>
            <input
              id="pyeong"
              type="number"
              value={pyeong}
              onChange={(e) => setPyeong(Number(e.target.value))}
              min={1}
            />
          </div>
          <div className="field">
            <label htmlFor="bedrooms">침실 수</label>
            <input
              id="bedrooms"
              type="number"
              value={bedrooms}
              onChange={(e) => setBedrooms(Number(e.target.value))}
              min={0}
            />
          </div>
        </div>
        <button className="btn ghost block" onClick={getQuote} disabled={loading || !start || !end}>
          {loading ? '계산 중...' : '견적 보기'}
        </button>
      </div>

      {quote ? (
        <div className="card" style={{ marginTop: '1rem' }}>
          <div className="list-item">
            <div>결제 금액</div>
            <div style={{ fontWeight: 700 }}>₩{quote.total.toLocaleString()}</div>
          </div>
          <div className="list-item">
            <div>플랫폼 수수료</div>
            <div className="meta">₩{quote.platformFee.toLocaleString()}</div>
          </div>
          <div className="list-item">
            <div>청소사 정산</div>
            <div className="meta">₩{quote.cleanerPayout.toLocaleString()}</div>
          </div>
          <button className="btn primary block" style={{ marginTop: '1rem' }}>
            토스로 결제
          </button>
        </div>
      ) : null}

      <footer className="foot">© hosthelper</footer>
    </div>
  );
}
