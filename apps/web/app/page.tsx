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
            <Link href="/host/properties"><ListItem left="호스트 · 숙소 캘린더 연결" right={<span>→</span>} /></Link>
            <Link href="/host"><ListItem left="호스트 대시보드 · 내 일감" right={<span>→</span>} /></Link>
            <Link href="/cleaner"><ListItem left="청소사 · 일감 보드" right={<span>→</span>} /></Link>
            <Link href="/messages"><ListItem left="호스트 ↔ 청소사 메시지" right={<span>→</span>} /></Link>
            <Link href="/live"><ListItem left="실시간 현황" right={<span>→</span>} /></Link>
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
          <h4>캘린더 연결</h4>
          <p>숙소 예약 캘린더만 연결하면 체크아웃마다 청소 일감이 자동 생성됩니다.</p>
        </div>
        <div className="hh-three__cell">
          <h4>일감 매칭</h4>
          <p>청소사가 일감 보드에서 보고 바로 수락합니다.</p>
        </div>
        <div className="hh-three__cell">
          <h4>메시지</h4>
          <p>호스트와 청소사가 일감별로 직접 소통합니다. 수수료는 건당 ₩10,000.</p>
        </div>
      </div>

      <Footer />
    </Wrap>
  );
}
