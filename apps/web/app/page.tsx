import Link from 'next/link';

export default function HomePage() {
  return (
    <div className="wrap">
      <nav className="nav">
        <span className="logo">hosthelper</span>
        <Link href="/login" className="login">로그인</Link>
      </nav>

      <section className="hero">
        <h1>시간을<br />효율적으로<br />아껴드립니다</h1>
        <p>턴오버 청소, 한 번에.</p>
        <div className="cta">
          <Link href="/host/new" className="btn primary">호스트로 시작</Link>
          <Link href="/cleaner/new" className="btn ghost">청소사로 시작</Link>
        </div>
      </section>

      <div className="divider" />

      <section className="three">
        <div className="cell">
          <h4>한 번에 매칭</h4>
          <p>체크아웃 알림만으로 청소사가 잡힙니다.</p>
        </div>
        <div className="cell">
          <h4>간편결제</h4>
          <p>토스로 결제, T+2 자동 정산.</p>
        </div>
        <div className="cell">
          <h4>건당 ₩10,000</h4>
          <p>수수료는 한 건당 정액. 그게 전부입니다.</p>
        </div>
      </section>

      <footer className="foot">© hosthelper</footer>
    </div>
  );
}
