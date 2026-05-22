import Link from 'next/link';

export default function HostNewPage() {
  return (
    <div className="wrap">
      <nav className="nav"><span className="logo">hosthelper</span></nav>
      <section className="hero">
        <h1>호스트로 시작</h1>
        <p>휴대폰 인증 후 바로 예약할 수 있습니다.</p>
        <div className="cta">
          <Link href="/login" className="btn primary">시작하기</Link>
        </div>
      </section>
    </div>
  );
}
