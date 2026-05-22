import Link from 'next/link';
import { Wrap, Nav, Section, Card, ListItem, Button, Footer } from '@hosthelper/ui';

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
    <Wrap>
      <Nav right={<Link href="/login">로그아웃</Link>} />

      <Section title="새 일감" />

      <Card>
        {offers.map((o) => (
          <ListItem
            key={o.id}
            left={
              <>
                <div>{o.property}</div>
                <div className="hh-list-item__meta">{o.district} · {o.time}</div>
              </>
            }
            right={
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontWeight: 700 }}>₩{o.payout.toLocaleString()}</div>
                <div className="hh-list-item__meta">{o.expiresInMin}분 남음</div>
              </div>
            }
          />
        ))}
      </Card>

      <div style={{ marginTop: '1.25rem' }} className="hh-inline">
        <Button variant="ghost" style={{ flex: 1 }}>거절</Button>
        <Button style={{ flex: 1 }}>수락</Button>
      </div>

      <Footer />
    </Wrap>
  );
}
