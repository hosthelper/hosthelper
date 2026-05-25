import Link from 'next/link';
import { Shell, StatCard, statGrid, card } from './ui';

const sections = [
  { href: '/live', title: '실시간 모니터링', desc: '예약·결제·매칭·분쟁 활동을 실시간 스트림으로' },
  { href: '/kyc', title: '청소사 KYC 승인', desc: '신규 청소 매니저 신원확인 검토·승인' },
  { href: '/disputes', title: '분쟁 처리', desc: 'AI 1차 판정 검토 및 최종 결정' },
  { href: '/weights', title: '매칭 가중치 튜닝', desc: '거리·평점·재예약률 등 매칭 점수 가중치 조정' },
  { href: '/payouts', title: '정산 reconciliation', desc: '청소사 정산 내역 확인·승인' },
];

export default function AdminHome() {
  return (
    <Shell title="운영자 콘솔">
      <section style={statGrid}>
        <StatCard label="진행 중 잡" value="12" />
        <StatCard label="대기 오퍼" value="5" />
        <StatCard label="오늘 예약" value="23" />
        <StatCard label="오늘 거래액" value="₩1,840,000" />
        <StatCard label="열린 분쟁" value="1" warn />
      </section>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '1rem', marginTop: '1.5rem' }}>
        {sections.map((s) => (
          <Link key={s.href} href={s.href} style={{ ...card, display: 'block' }}>
            <div style={{ fontWeight: 700, marginBottom: '0.35rem' }}>{s.title}</div>
            <div style={{ color: '#6b7280', fontSize: '0.9rem' }}>{s.desc}</div>
          </Link>
        ))}
      </div>
    </Shell>
  );
}
