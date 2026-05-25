'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Wrap, Section, Card, Field, TextInput, Button, ListItem, Badge, Footer } from '@hosthelper/ui';
import { AppNav } from '../../nav';
import { DEMO } from '../../demo';
import { addBooking, randomCleaner } from '../../demo-store';

interface Quote {
  total: number;
  platformFee: number;
  cleanerPayout: number;
}

function fmtTime(value: string): string {
  if (!value) return '예약 시각 미정';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString('ko-KR', { month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export default function BookPage() {
  const [property, setProperty] = useState('청담 스카이뷰 #301');
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [pyeong, setPyeong] = useState(22);
  const [bedrooms, setBedrooms] = useState(2);
  const [quote, setQuote] = useState<Quote | null>(null);
  const [loading, setLoading] = useState(false);
  const [paidCleaner, setPaidCleaner] = useState<string | null>(null);

  const api = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:4000';

  async function getQuote() {
    if (!start || !end) return;
    if (DEMO) {
      const platformFee = 10000;
      const base = 40000 + pyeong * 1500 + bedrooms * 8000;
      const total = base + platformFee;
      setQuote({ total, platformFee, cleanerPayout: total - platformFee });
      return;
    }
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

  function pay() {
    if (!quote) return;
    const cleaner = randomCleaner();
    addBooking({
      id: `b-${Date.now()}`,
      property,
      time: fmtTime(start),
      total: quote.total,
      status: 'matched',
      cleaner,
    });
    setPaidCleaner(cleaner);
  }

  if (paidCleaner) {
    return (
      <Wrap>
        <AppNav />
        <Section title="결제 완료" />
        <Card>
          <div style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '0.75rem' }}>
            예약이 확정되고 청소 매니저가 매칭되었습니다 ✓
          </div>
          <ListItem left="숙소" right={<span>{property}</span>} />
          <ListItem left="일시" right={<span>{fmtTime(start)}</span>} />
          <ListItem
            left="매칭된 청소 매니저"
            right={
              <span className="hh-inline" style={{ alignItems: 'center' }}>
                {paidCleaner}
                <Badge tone="live">매칭 완료</Badge>
              </span>
            }
          />
        </Card>
        <div className="hh-inline" style={{ marginTop: '1.25rem', flexWrap: 'wrap' }}>
          <Link href="/host" style={{ flex: 1, minWidth: 180 }}>
            <Button block>내 일정 보기</Button>
          </Link>
          <Link href="/live" style={{ flex: 1, minWidth: 180 }}>
            <Button variant="ghost" block>실시간 현황</Button>
          </Link>
        </div>
        <Footer />
      </Wrap>
    );
  }

  return (
    <Wrap>
      <AppNav />

      <Section title="청소 예약" />

      <Card>
        <Field label="숙소" htmlFor="property">
          <TextInput id="property" value={property} onChange={(e) => setProperty(e.target.value)} />
        </Field>
        <Field label="시작 시각" htmlFor="start">
          <TextInput id="start" type="datetime-local" value={start} onChange={(e) => setStart(e.target.value)} />
        </Field>
        <Field label="종료 시각" htmlFor="end">
          <TextInput id="end" type="datetime-local" value={end} onChange={(e) => setEnd(e.target.value)} />
        </Field>
        <div className="hh-row">
          <Field label="평수" htmlFor="pyeong">
            <TextInput id="pyeong" type="number" value={pyeong} onChange={(e) => setPyeong(Number(e.target.value))} min={1} />
          </Field>
          <Field label="침실 수" htmlFor="bedrooms">
            <TextInput id="bedrooms" type="number" value={bedrooms} onChange={(e) => setBedrooms(Number(e.target.value))} min={0} />
          </Field>
        </div>
        <Button variant="ghost" block onClick={getQuote} disabled={loading || !start || !end}>
          {loading ? '계산 중...' : '견적 보기'}
        </Button>
      </Card>

      {quote ? (
        <div style={{ marginTop: '1rem' }}>
          <Card>
            <ListItem left="결제 금액" right={<strong>₩{quote.total.toLocaleString()}</strong>} />
            <ListItem left="플랫폼 수수료" right={<span className="hh-list-item__meta">₩{quote.platformFee.toLocaleString()}</span>} />
            <ListItem left="청소사 정산" right={<span className="hh-list-item__meta">₩{quote.cleanerPayout.toLocaleString()}</span>} />
            <div style={{ marginTop: '1rem' }}>
              <Button block onClick={pay}>토스로 결제</Button>
            </div>
          </Card>
        </div>
      ) : null}

      <Footer />
    </Wrap>
  );
}
