import Link from 'next/link';

interface Offer {
  id: string;
  property: string;
  time: string;
  district: string;
  payout: number;
  expiresInMin: number;
}

const offers: Offer[] = [
  { id: 'o-1', property: '청담 스카이뷰', district: '강남구', time: '오늘 14:00', payout: 65000, expiresInMin: 12 },
  { id: 'o-2', property: '한남 리버하우스', district: '용산구', time: '오늘 16:00', payout: 78000, expiresInMin: 7 },
];

export default function CleanerHome() {
  return (
    <div className="wrap">
      <nav className="nav">
        <span className="logo">hosthelper</span>
        <Link href="/login" className="login">로그아웃</Link>
      </nav>

      <section style={{ padding: '2.5rem 0 1rem' }}>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 700 }}>새 일감</h1>
      </section>

      <div className="card">
        {offers.map((o) => (
          <div key={o.id} className="list-item">
            <div>
              <div>{o.property}</div>
              <div className="meta">{o.district} · {o.time}</div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontWeight: 700 }}>₩{o.payout.toLocaleString()}</div>
              <div className="meta">{o.expiresInMin}분 남음</div>
            </div>
          </div>
        ))}
      </div>

      <div style={{ marginTop: '1.25rem', display: 'flex', gap: '0.5rem' }}>
        <button className="btn ghost" style={{ flex: 1 }}>거절</button>
        <button className="btn primary" style={{ flex: 1 }}>수락</button>
      </div>

      <footer className="foot">© hosthelper</footer>
    </div>
  );
}
