import Link from 'next/link';

export default function HomePage() {
  return (
    <main className="container">
      <header>
        <h1>hosthelper</h1>
        <p className="tagline">수익형 숙박을 위한 청소 운영관리 매칭 SaaS</p>
      </header>

      <section className="cta">
        <Link href="/host" className="btn primary">
          호스트로 시작하기
        </Link>
        <Link href="/cleaner" className="btn secondary">
          청소 매니저로 시작하기
        </Link>
      </section>

      <section className="features">
        <article>
          <h3>턴오버 SLA</h3>
          <p>체크아웃→체크인 사이 4시간 안에 매칭부터 청소까지.</p>
        </article>
        <article>
          <h3>사진검수 체크리스트</h3>
          <p>방별 before/after 사진으로 품질을 보장합니다.</p>
        </article>
        <article>
          <h3>자동 정산 T+2</h3>
          <p>분쟁 윈도우 후 청소사 자동 정산. 세금계산서까지.</p>
        </article>
      </section>

      <footer>
        <small>© 2026 hosthelper · 서울 파일럿 운영 중</small>
      </footer>
    </main>
  );
}
