import Link from 'next/link';
import { HeroCarousel } from './_hero';

const services = [
  { ic: '연', title: '숙소 캘린더 연결', desc: 'Airbnb 등 예약 캘린더를 연결하면 체크아웃마다 청소 일감이 자동 생성됩니다.', href: '/host/properties' as const },
  { ic: '잡', title: '청소 일감 보드', desc: '호스트가 올린 청소를 청소 매니저가 보고 바로 수락해 매칭됩니다.', href: '/cleaner' as const },
  { ic: '톡', title: '메시지 & 정산', desc: '호스트와 청소사가 일감별로 직접 소통하고, 수수료·정산은 자동으로.', href: '/messages' as const },
];

const steps = [
  { n: 1, title: '호스트가 일감 등록', desc: '캘린더 연결 또는 직접 등록으로 청소 일감을 올려요.' },
  { n: 2, title: '청소사가 수락', desc: '일감 보드에서 보고 한 번에 수락하면 매칭 완료.' },
  { n: 3, title: '소통하고 완료', desc: '메시지로 세부사항을 맞추고, 청소 완료 후 자동 정산.' },
];

const regions = ['강남구', '서초구', '용산구', '마포구', '송파구', '성동구', '광진구', '영등포구'];

export default function HomePage() {
  return (
    <>
      <div className="site-container site-pt">
        <HeroCarousel />
      </div>

      <section className="site-container site-mt">
        <h2 className="site-h2">이렇게 이어드려요</h2>
        <p className="site-sub">호스트의 청소 고민과 청소 매니저의 일감을 한곳에서.</p>
        <div className="site-grid cols-3" style={{ marginTop: '1.4rem' }}>
          {services.map((s) => (
            <Link key={s.title} href={s.href} className="site-card">
              <div className="site-card__ic">{s.ic}</div>
              <h3>{s.title}</h3>
              <p>{s.desc}</p>
            </Link>
          ))}
        </div>
      </section>

      <section className="site-container site-mt">
        <h2 className="site-h2">이용 방법</h2>
        <p className="site-sub">한 화면에서 호스트와 청소사 양쪽을 체험해볼 수 있어요.</p>
        <div className="site-grid cols-3" style={{ marginTop: '1.4rem' }}>
          {steps.map((s) => (
            <div key={s.n} className="site-card">
              <div className="site-card__ic">{s.n}</div>
              <h3>{s.title}</h3>
              <p>{s.desc}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="site-container site-mt">
        <h2 className="site-h2">서비스 지역</h2>
        <p className="site-sub">서울 전역 파일럿 운영 중.</p>
        <div className="site-chips" style={{ marginTop: '1.2rem' }}>
          {regions.map((r) => (
            <Link key={r} href="/cleaner" className="site-chip">{r}</Link>
          ))}
        </div>
      </section>

      <section className="site-container site-mt">
        <div className="site-promo">
          <h2>지금 바로 둘러보세요</h2>
          <p>호스트로 일감을 올리고, 청소사로 수락하고, 메시지까지 — 1분이면 흐름이 보여요.</p>
          <div style={{ display: 'flex', gap: '0.6rem', justifyContent: 'center', flexWrap: 'wrap', marginTop: '1.5rem' }}>
            <Link href="/host/properties" className="site-btn" style={{ background: '#fff', color: '#222' }}>
              호스트로 체험 시작
            </Link>
            <Link href="/cleaner" className="site-btn site-btn--ghost">
              청소사 화면 보기
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
