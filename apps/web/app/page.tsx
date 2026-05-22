import Link from 'next/link';
import { Wrap, Nav, Hero, Button, Divider, Footer } from '@hosthelper/ui';

export default function HomePage() {
  return (
    <Wrap>
      <Nav right={<Link href="/login">로그인</Link>} />

      <Hero
        title={
          <>
            시간을<br />
            효율적으로<br />
            아껴드립니다
          </>
        }
        subtitle="턴오버 청소, 한 번에."
        ctas={
          <>
            <Link href="/host/new"><Button variant="primary">호스트로 시작</Button></Link>
            <Link href="/cleaner/new"><Button variant="ghost">청소사로 시작</Button></Link>
          </>
        }
      />

      <Divider />

      <div className="hh-three">
        <div className="hh-three__cell">
          <h4>한 번에 매칭</h4>
          <p>체크아웃 알림만으로 청소사가 잡힙니다.</p>
        </div>
        <div className="hh-three__cell">
          <h4>간편결제</h4>
          <p>토스로 결제, T+2 자동 정산.</p>
        </div>
        <div className="hh-three__cell">
          <h4>건당 ₩10,000</h4>
          <p>수수료는 한 건당 정액.</p>
        </div>
      </div>

      <Footer />
    </Wrap>
  );
}
