'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Wrap, Section, Card, Field, TextInput, Button, ListItem } from '@hosthelper/ui';
import { DEMO } from '../../demo';
import { addJob, PLATFORM_FEE } from '../../demo-store';

interface Quote {
  total: number;
  platformFee: number;
  cleanerPayout: number;
}

export default function BookPage() {
  const [property, setProperty] = useState('청담 스카이뷰 #301');
  const [district, setDistrict] = useState('강남구');
  const [time, setTime] = useState('내일 14:00');
  const [pyeong, setPyeong] = useState(22);
  const [bedrooms, setBedrooms] = useState(2);
  const [quote, setQuote] = useState<Quote | null>(null);
  const [loading, setLoading] = useState(false);
  const [posted, setPosted] = useState(false);

  const api = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:4000';

  async function getQuote() {
    if (DEMO) {
      const base = 40000 + pyeong * 1500 + bedrooms * 8000;
      const total = base + PLATFORM_FEE;
      setQuote({ total, platformFee: PLATFORM_FEE, cleanerPayout: total - PLATFORM_FEE });
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`${api}/api/pricing/quote`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ pyeong, bedrooms }),
      });
      if (res.ok) setQuote((await res.json()) as Quote);
    } finally {
      setLoading(false);
    }
  }

  function post() {
    if (!quote) return;
    addJob({
      property,
      district,
      time,
      payout: quote.cleanerPayout,
      total: quote.total,
      status: 'open',
      source: 'manual',
    });
    setPosted(true);
  }

  if (posted) {
    return (
      <Wrap>
        <Section title="일감 등록 완료" />
        <Card>
          <div style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '0.75rem' }}>
            청소 일감이 등록되었습니다 — 청소사 모집 중 ✓
          </div>
          <ListItem left="숙소" right={<span>{property}</span>} />
          <ListItem left="지역 · 일시" right={<span>{district} · {time}</span>} />
          <ListItem left="청소사 정산액" right={<span>₩{quote?.cleanerPayout.toLocaleString()}</span>} />
          <p className="hh-list-item__meta" style={{ marginTop: '0.75rem' }}>
            청소사가 수락하면 알림과 함께 메시지를 주고받을 수 있습니다.
          </p>
        </Card>
        <div className="hh-inline" style={{ marginTop: '1.25rem', flexWrap: 'wrap' }}>
          <Link href="/host" style={{ flex: 1, minWidth: 180 }}>
            <Button block>대시보드로</Button>
          </Link>
          <Link href="/cleaner" style={{ flex: 1, minWidth: 180 }}>
            <Button variant="ghost" block>청소사 화면에서 보기</Button>
          </Link>
        </div>
      </Wrap>
    );
  }

  return (
    <Wrap>
      <Section title="직접 일감 등록" />

      <Card>
        <Field label="숙소" htmlFor="property">
          <TextInput id="property" value={property} onChange={(e) => setProperty(e.target.value)} />
        </Field>
        <div className="hh-row">
          <Field label="지역(구)" htmlFor="district">
            <TextInput id="district" value={district} onChange={(e) => setDistrict(e.target.value)} />
          </Field>
          <Field label="청소 시각" htmlFor="time">
            <TextInput id="time" value={time} onChange={(e) => setTime(e.target.value)} />
          </Field>
        </div>
        <div className="hh-row">
          <Field label="평수" htmlFor="pyeong">
            <TextInput id="pyeong" type="number" value={pyeong} onChange={(e) => setPyeong(Number(e.target.value))} min={1} />
          </Field>
          <Field label="침실 수" htmlFor="bedrooms">
            <TextInput id="bedrooms" type="number" value={bedrooms} onChange={(e) => setBedrooms(Number(e.target.value))} min={0} />
          </Field>
        </div>
        <Button variant="ghost" block onClick={getQuote} disabled={loading}>
          {loading ? '계산 중...' : '견적 보기'}
        </Button>
      </Card>

      {quote ? (
        <div style={{ marginTop: '1rem' }}>
          <Card>
            <ListItem left="호스트 결제액" right={<strong>₩{quote.total.toLocaleString()}</strong>} />
            <ListItem left="플랫폼 수수료" right={<span className="hh-list-item__meta">₩{quote.platformFee.toLocaleString()}</span>} />
            <ListItem left="청소사 정산" right={<span className="hh-list-item__meta">₩{quote.cleanerPayout.toLocaleString()}</span>} />
            <div style={{ marginTop: '1rem' }}>
              <Button block onClick={post}>일감 등록 (청소사 모집)</Button>
            </div>
          </Card>
        </div>
      ) : null}
    </Wrap>
  );
}
