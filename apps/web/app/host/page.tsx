import Link from 'next/link';
import { Wrap, Nav, Section, Card, ListItem, Badge, Button, Footer } from '@hosthelper/ui';
import type { BadgeTone } from '@hosthelper/ui';

interface Job {
  id: string;
  property: string;
  time: string;
  status: 'matched' | 'requested' | 'in_progress' | 'done';
  cleaner?: string;
}

const stubJobs: Job[] = [
  { id: 'j-1', property: '청담 스카이뷰 #301', time: '오늘 11:00', status: 'matched', cleaner: '박매니저' },
  { id: 'j-2', property: '청담 스카이뷰 #301', time: '내일 11:00', status: 'requested' },
  { id: 'j-3', property: '청담 스카이뷰 #301', time: '5/24 11:00', status: 'requested' },
];

const labels: Record<Job['status'], { text: string; tone: BadgeTone }> = {
  matched: { text: '매칭 완료', tone: 'live' },
  requested: { text: '매칭 중', tone: 'warn' },
  in_progress: { text: '진행 중', tone: 'live' },
  done: { text: '완료', tone: 'default' },
};

export default function HostDashboard() {
  return (
    <Wrap>
      <Nav right={<Link href="/login">로그아웃</Link>} />

      <Section title="오늘 일정" />

      <Card>
        {stubJobs.map((j) => (
          <ListItem
            key={j.id}
            left={
              <>
                <div>{j.property}</div>
                <div className="hh-list-item__meta">
                  {j.time} {j.cleaner ? `· ${j.cleaner}` : ''}
                </div>
              </>
            }
            right={<Badge tone={labels[j.status].tone}>{labels[j.status].text}</Badge>}
          />
        ))}
      </Card>

      <div style={{ marginTop: '1.25rem' }}>
        <Link href="/host/book"><Button block>청소 예약하기</Button></Link>
      </div>

      <Footer />
    </Wrap>
  );
}
