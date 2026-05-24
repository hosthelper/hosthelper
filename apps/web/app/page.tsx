import Link from 'next/link';
import { Wrap, Nav, Hero, Button, Divider, Footer, ListItem, Card, Section } from '@hosthelper/ui';
import { DEMO, ADMIN_URL } from './demo';

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

      {DEMO ? (
        <>
          <Section title="둘러보기 (데모)" />
          <Card>
            <Link href="/login"><ListItem left="회원 로그인" right={<span>→</span>} /></Link>
            <Link href="/host"><ListItem left="호스트 대시보드" right={<span>→</span>} /></Link>
            <Link href="/host/book"><ListItem left="청소 예약 · 견적" right={<span>→</span>} /></Link>
            <Link href="/cleaner"><ListItem left="청소사 일감" right={<span>→</span>} /></Link>
            <Link href="/live"><ListItem left="실시간 현황" right={<span>→</span>} /></Link>
            <Link href="/library"><ListItem left="디자인 컴포넌트" right={<span>→</span>} /></Link>
            {ADMIN_URL ? (
              <a href={ADMIN_URL} target="_blank" rel="noreferrer">
                <ListItem left="운영진 실시간 대시보드" right={<span>↗</span>} />
              </a>
            ) : null}
          </Card>
        </>
      ) : null}

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
