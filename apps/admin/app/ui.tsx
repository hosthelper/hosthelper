import Link from 'next/link';
import type { CSSProperties, ReactNode } from 'react';

// admin 전용 경량 디자인(인라인 스타일) — @hosthelper/ui에 의존하지 않고 일관된 운영자 콘솔 룩 제공.

const NAV = [
  { href: '/', label: '콘솔' },
  { href: '/live', label: '실시간' },
  { href: '/kyc', label: 'KYC 승인' },
  { href: '/disputes', label: '분쟁' },
  { href: '/weights', label: '가중치' },
  { href: '/payouts', label: '정산' },
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
    <div style={{ maxWidth: 1040, margin: '0 auto' }}>
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
        <Link href="/" style={{ fontWeight: 700 }}>
          hosthelper <span style={{ color: '#6b7280', fontWeight: 500 }}>운영자</span>
        </Link>
        <span style={{ flex: 1 }} />
        {NAV.map((n) => (
          <Link key={n.href} href={n.href} style={{ color: '#6b7280', fontSize: '0.9rem' }}>
            {n.label}
          </Link>
        ))}
      </nav>

      <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', margin: '1.5rem 0' }}>
        <h1 style={{ margin: 0, fontSize: '1.5rem' }}>{title}</h1>
        {actions ?? null}
      </header>

      {children}
    </div>
  );
}

export function StatCard({ label, value, warn }: { label: string; value: ReactNode; warn?: boolean }) {
  return (
    <div style={card}>
      <div style={{ color: '#6b7280', fontSize: '0.85rem' }}>{label}</div>
      <div style={{ fontSize: '1.6rem', fontWeight: 700, marginTop: '0.25rem', color: warn ? '#c2410c' : '#0a0a0a' }}>
        {value}
      </div>
    </div>
  );
}

export const statGrid: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
  gap: '0.75rem',
};

export function Btn({
  children,
  onClick,
  variant = 'primary',
}: {
  children: ReactNode;
  onClick?: () => void;
  variant?: 'primary' | 'ghost';
}) {
  const base: CSSProperties = {
    padding: '0.45rem 0.9rem',
    borderRadius: 8,
    fontSize: '0.85rem',
    fontWeight: 600,
    cursor: 'pointer',
    border: '1px solid',
  };
  const style: CSSProperties =
    variant === 'primary'
      ? { ...base, background: '#0a0a0a', color: '#fff', borderColor: '#0a0a0a' }
      : { ...base, background: '#fff', color: '#0a0a0a', borderColor: '#ececec' };
  return (
    <button type="button" onClick={onClick} style={style}>
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
