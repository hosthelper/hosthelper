import Link from 'next/link';
import { Wrap, Nav, Hero, Button, Divider, Footer, Card, Section } from '@hosthelper/ui';
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
          <Section title="1분 체험 가이드" />
          <p className="hh-list-item__meta" style={{ marginTop: '-0.5rem' }}>
            이 데모는 한 화면에서 <b>호스트</b>(일감 올리는 쪽)와 <b>청소사</b>(일감 받는 쪽)를 모두 체험할 수 있어요.
          </p>
          <Card>
            <Step n={1} title="호스트: 청소 일감 올리기" desc="숙소 캘린더를 연결하면 체크아웃마다 일감이 자동 생성돼요. (직접 등록도 가능)" />
            <Step n={2} title="청소사: 일감 수락하기" desc="일감 보드에서 올라온 청소를 보고 '수락'을 누르면 매칭됩니다." />
            <Step n={3} title="메시지로 소통하기" desc="호스트와 청소사가 대화해요. ('역할 전환' 버튼으로 양쪽을 다 볼 수 있어요)" />
          </Card>
          <div className="hh-inline" style={{ marginTop: '1rem', flexWrap: 'wrap' }}>
            <Link href="/host/properties" style={{ flex: 1, minWidth: 180 }}>
              <Button block>① 호스트로 체험 시작</Button>
            </Link>
            <Link href="/cleaner" style={{ flex: 1, minWidth: 180 }}>
              <Button variant="ghost" block>② 청소사 화면 보기</Button>
            </Link>
          </div>
          {ADMIN_URL ? (
            <p style={{ marginTop: '0.75rem', textAlign: 'center' }}>
              <a href={ADMIN_URL} target="_blank" rel="noreferrer" className="hh-list-item__meta">
                운영진 실시간 대시보드 ↗
              </a>
            </p>
          ) : null}
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

function Step({ n, title, desc }: { n: number; title: string; desc: string }) {
  return (
    <div style={{ display: 'flex', gap: '0.85rem', padding: '0.9rem 0', borderBottom: '1px solid var(--hh-line)' }}>
      <div
        style={{
          flex: '0 0 1.75rem',
          height: '1.75rem',
          borderRadius: 999,
          background: '#0a0a0a',
          color: '#fff',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '0.85rem',
          fontWeight: 700,
        }}
      >
        {n}
      </div>
      <div>
        <div style={{ fontWeight: 600 }}>{title}</div>
        <div className="hh-list-item__meta" style={{ marginTop: '0.15rem' }}>{desc}</div>
      </div>
    </div>
  );
}
