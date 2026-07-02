'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import type { Route } from 'next';

interface Slide {
  tag: string;
  title: string;
  sub: string;
  bg: string;
  cta: { label: string; href: Route };
  cta2?: { label: string; href: Route };
}

const SLIDES: Slide[] = [
  {
    tag: '자동 생성',
    title: '체크아웃 청소,\n자동으로 이어드려요',
    sub: '숙소 예약 캘린더만 연결하면 손님이 나갈 때마다 청소 일감이 자동으로 생성됩니다.',
    bg: 'linear-gradient(135deg, #34d399 0%, #16a34a 100%)',
    cta: { label: '호스트로 시작', href: '/host/properties' },
    cta2: { label: '어떻게 되나요?', href: '/host' },
  },
  {
    tag: '즉시 매칭',
    title: '검증된 청소 매니저,\n폰으로 바로 매칭',
    sub: '청소사가 일감 보드에서 보고 한 번에 수락합니다. 수락되면 바로 대화를 시작해요.',
    bg: 'linear-gradient(135deg, #14532d 0%, #166534 100%)',
    cta: { label: '일감 보드 보기', href: '/cleaner' },
  },
  {
    tag: '투명한 수수료',
    title: '수수료는 건당 ₩10,000,\n정산도 자동',
    sub: '복잡한 계약 없이 한 건씩 투명하게. 청소 완료 후 정산까지 자동으로.',
    bg: 'linear-gradient(135deg, #0d9488 0%, #059669 100%)',
    cta: { label: '메시지 데모 보기', href: '/messages' },
  },
];

export function HeroCarousel() {
  const [i, setI] = useState(0);

  useEffect(() => {
    const t = setInterval(() => setI((x) => (x + 1) % SLIDES.length), 4500);
    return () => clearInterval(t);
  }, []);

  const s = SLIDES[i]!;

  return (
    <div className="site-hero" style={{ background: s.bg }}>
      <span className="site-hero__tag">{s.tag}</span>
      <h1 style={{ whiteSpace: 'pre-line' }}>{s.title}</h1>
      <p>{s.sub}</p>
      <div className="site-hero__cta">
        <Link href={s.cta.href} className="site-btn site-btn--primary">
          {s.cta.label}
        </Link>
        {s.cta2 ? (
          <Link href={s.cta2.href} className="site-btn site-btn--ghost">
            {s.cta2.label}
          </Link>
        ) : null}
      </div>
      <div className="site-dots">
        {SLIDES.map((_, idx) => (
          <button
            key={idx}
            className={idx === i ? 'on' : ''}
            onClick={() => setI(idx)}
            aria-label={`슬라이드 ${idx + 1}`}
          />
        ))}
      </div>
    </div>
  );
}
