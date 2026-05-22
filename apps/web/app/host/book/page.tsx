'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Wrap, Nav, Section, Card, Field, TextInput, Button, ListItem, Footer } from '@hosthelper/ui';

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
    <Wrap>
      <Nav right={<Link href="/host">취소</Link>} />

      <Section title="청소 예약" />

      <Card>
        <Field label="시작 시각" htmlFor="start">
          <TextInput
            id="start"
            type="datetime-local"
            value={start}
            onChange={(e) => setStart(e.target.value)}
          />
        </Field>
        <Field label="종료 시각" htmlFor="end">
          <TextInput
            id="end"
            type="datetime-local"
            value={end}
            onChange={(e) => setEnd(e.target.value)}
          />
        </Field>
        <div className="hh-row">
          <Field label="평수" htmlFor="pyeong">
            <TextInput
              id="pyeong"
              type="number"
              value={pyeong}
              onChange={(e) => setPyeong(Number(e.target.value))}
              min={1}
            />
          </Field>
          <Field label="침실 수" htmlFor="bedrooms">
            <TextInput
              id="bedrooms"
              type="number"
              value={bedrooms}
              onChange={(e) => setBedrooms(Number(e.target.value))}
              min={0}
            />
          </Field>
        </div>
        <Button variant="ghost" block onClick={getQuote} disabled={loading || !start || !end}>
          {loading ? '계산 중...' : '견적 보기'}
        </Button>
      </Card>

      {quote ? (
        <div style={{ marginTop: '1rem' }}>
          <Card>
            <ListItem
              left="결제 금액"
              right={<strong>₩{quote.total.toLocaleString()}</strong>}
            />
            <ListItem
              left="플랫폼 수수료"
              right={<span className="hh-list-item__meta">₩{quote.platformFee.toLocaleString()}</span>}
            />
            <ListItem
              left="청소사 정산"
              right={<span className="hh-list-item__meta">₩{quote.cleanerPayout.toLocaleString()}</span>}
            />
            <div style={{ marginTop: '1rem' }}>
              <Button block>토스로 결제</Button>
            </div>
          </Card>
        </div>
      ) : null}

      <Footer />
    </Wrap>
  );
}
