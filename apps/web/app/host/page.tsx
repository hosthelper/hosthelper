'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Wrap, Section, Card, ListItem, Badge, Button, Footer } from '@hosthelper/ui';
import type { BadgeTone } from '@hosthelper/ui';
import { AppNav } from '../nav';
import { getBookings, type DemoBooking } from '../demo-store';

interface Job {
  id: string;
  property: string;
  time: string;
  status: 'matched' | 'requested' | 'in_progress' | 'done';
  cleaner?: string;
}

const seedJobs: Job[] = [
  { id: 'j-1', property: '청담 스카이뷰 #301', time: '오늘 11:00', status: 'in_progress', cleaner: '박지은 매니저' },
  { id: 'j-2', property: '한남 리버하우스', time: '내일 14:00', status: 'matched', cleaner: '김서연 매니저' },
  { id: 'j-3', property: '청담 스카이뷰 #301', time: '5/27 11:00', status: 'requested' },
];

const labels: Record<Job['status'], { text: string; tone: BadgeTone }> = {
  matched: { text: '매칭 완료', tone: 'live' },
  requested: { text: '매칭 중', tone: 'warn' },
  in_progress: { text: '진행 중', tone: 'live' },
  done: { text: '완료', tone: 'default' },
};

export default function HostDashboard() {
  const [booked, setBooked] = useState<DemoBooking[]>([]);

  useEffect(() => {
    setBooked(getBookings());
  }, []);

  const jobs: Job[] = [
    ...booked.map((b) => ({
      id: b.id,
      property: b.property,
      time: b.time,
      status: b.status,
      cleaner: b.cleaner,
    })),
    ...seedJobs,
  ];

  const inProgress = jobs.filter((j) => j.status === 'in_progress' || j.status === 'matched').length;
  const waiting = jobs.filter((j) => j.status === 'requested').length;
  const spend = booked.reduce((s, b) => s + b.total, 0) + 320000;

  return (
    <Wrap>
      <AppNav />

      <Section title="호스트 대시보드" />

      <div className="hh-row" style={{ flexWrap: 'wrap' }}>
        <Stat label="진행/예정" value={`${inProgress}건`} />
        <Stat label="매칭 대기" value={`${waiting}건`} />
        <Stat label="이번 달 지출" value={`₩${spend.toLocaleString()}`} />
      </div>

      <div style={{ marginTop: '1.5rem' }}>
        <Section title="내 일정" />
        <Card>
          {jobs.map((j) => (
            <ListItem
              key={j.id}
              left={
                <>
                  <div>{j.property}</div>
                  <div className="hh-list-item__meta">
                    {j.time}
                    {j.cleaner ? ` · ${j.cleaner}` : ''}
                  </div>
                </>
              }
              right={<Badge tone={labels[j.status].tone}>{labels[j.status].text}</Badge>}
            />
          ))}
        </Card>
      </div>

      <div className="hh-inline" style={{ marginTop: '1.25rem', flexWrap: 'wrap' }}>
        <Link href="/host/book" style={{ flex: 1, minWidth: 180 }}>
          <Button block>청소 예약하기</Button>
        </Link>
        <Link href="/live" style={{ flex: 1, minWidth: 180 }}>
          <Button variant="ghost" block>실시간 현황 보기</Button>
        </Link>
      </div>

      <Footer />
    </Wrap>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ flex: '1 1 140px', minWidth: 140 }}>
      <Card>
        <div className="hh-list-item__meta">{label}</div>
        <div style={{ fontSize: '1.4rem', fontWeight: 700, marginTop: '0.25rem' }}>{value}</div>
      </Card>
    </div>
  );
}
