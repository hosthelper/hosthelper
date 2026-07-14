import Link from 'next/link';
import type { CSSProperties, ReactNode } from 'react';

// 창업이지 전용 경량 디자인(인라인 스타일) — apps/admin/app/ui.tsx 패턴.
// @hosthelper/ui는 호스트헬퍼 브랜딩이라 사용하지 않는다 (분리 매각 가능성 유지).

export const BRAND = '#1d4ed8';

const NAV = [
  { href: '/s', label: '설문' },
  { href: '/ops/leads', label: '리드' },
  { href: '/ops/listings', label: '매물' },
];

export const card: CSSProperties = {
  border: '1px solid #ececec',
  borderRadius: 10,
  padding: '1.25rem',
  background: '#fff',
};

export const pill: CSSProperties = {
  fontSize: '0.75rem',
  padding: '0.15rem 0.55rem',
  border: '1px solid #ececec',
  borderRadius: 999,
  whiteSpace: 'nowrap',
};

export function Shell({
  title,
  actions,
  children,
}: {
  title: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div style={{ maxWidth: 1040, margin: '0 auto', padding: '1.25rem' }}>
      <nav
        style={{
          display: 'flex',
          gap: '1.1rem',
          alignItems: 'center',
          flexWrap: 'wrap',
          paddingBottom: '1rem',
          borderBottom: '1px solid #ececec',
        }}
      >
        <Link href="/s" style={{ fontWeight: 700, color: BRAND, textDecoration: 'none' }}>
          창업이지
        </Link>
        <span style={{ flex: 1 }} />
        {NAV.map((n) => (
          <Link
            key={n.href}
            href={n.href}
            style={{ color: '#6b7280', fontSize: '0.9rem', textDecoration: 'none' }}
          >
            {n.label}
          </Link>
        ))}
      </nav>

      <header
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          margin: '1.5rem 0',
          flexWrap: 'wrap',
          gap: '0.5rem',
        }}
      >
        <h1 style={{ margin: 0, fontSize: '1.4rem' }}>{title}</h1>
        {actions ?? null}
      </header>

      {children}
    </div>
  );
}

export function Btn({
  children,
  onClick,
  variant = 'primary',
  type = 'button',
  disabled,
}: {
  children: ReactNode;
  onClick?: () => void;
  variant?: 'primary' | 'ghost';
  type?: 'button' | 'submit';
  disabled?: boolean;
}) {
  const base: CSSProperties = {
    padding: '0.45rem 0.9rem',
    borderRadius: 8,
    fontSize: '0.85rem',
    fontWeight: 600,
    cursor: disabled ? 'not-allowed' : 'pointer',
    border: '1px solid',
    opacity: disabled ? 0.6 : 1,
  };
  const style: CSSProperties =
    variant === 'primary'
      ? { ...base, background: BRAND, color: '#fff', borderColor: BRAND }
      : { ...base, background: '#fff', color: '#0a0a0a', borderColor: '#ececec' };
  return (
    <button type={type} onClick={onClick} style={style} disabled={disabled}>
      {children}
    </button>
  );
}

export const th: CSSProperties = {
  textAlign: 'left',
  padding: '0.6rem 0.5rem',
  borderBottom: '1px solid #ececec',
  color: '#6b7280',
  fontSize: '0.8rem',
  fontWeight: 600,
};
export const td: CSSProperties = {
  padding: '0.7rem 0.5rem',
  borderBottom: '1px solid #f3f4f6',
  fontSize: '0.9rem',
  verticalAlign: 'middle',
};

export const input: CSSProperties = {
  width: '100%',
  boxSizing: 'border-box',
  padding: '0.6rem 0.75rem',
  border: '1px solid #d1d5db',
  borderRadius: 8,
  fontSize: '0.95rem',
};

export const label: CSSProperties = {
  display: 'block',
  fontSize: '0.85rem',
  fontWeight: 600,
  color: '#374151',
  margin: '1rem 0 0.35rem',
};

// 금액 표시: 원 → "3억 5,000만원" / "5,000만원"
export function fmtWon(won: number | null | undefined): string {
  if (won === null || won === undefined) return '무관';
  const man = Math.round(won / 10_000);
  const eok = Math.floor(man / 10_000);
  const rest = man % 10_000;
  if (eok > 0) return rest > 0 ? `${eok}억 ${rest.toLocaleString('ko-KR')}만원` : `${eok}억원`;
  return `${man.toLocaleString('ko-KR')}만원`;
}

// 매칭 점수 바 (0..1)
export function ScoreBar({ value }: { value: number }) {
  const pct = Math.round(value * 100);
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', minWidth: 110 }}>
      <div style={{ flex: 1, height: 8, background: '#f3f4f6', borderRadius: 999 }}>
        <div
          style={{
            width: `${pct}%`,
            height: '100%',
            background: pct >= 70 ? '#16a34a' : pct >= 40 ? BRAND : '#9ca3af',
            borderRadius: 999,
          }}
        />
      </div>
      <span style={{ fontSize: '0.8rem', color: '#6b7280', width: 34, textAlign: 'right' }}>
        {pct}
      </span>
    </div>
  );
}
