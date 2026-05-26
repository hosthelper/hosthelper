'use client';

import Link from 'next/link';
import { Wrap, Section, Card, ListItem, Badge, Button, Footer } from '@hosthelper/ui';
import type { BadgeTone } from '@hosthelper/ui';
import { AppNav } from '../nav';
import { getJobs, getProperties, useStoreVersion, type JobStatus } from '../demo-store';

const LABEL: Record<JobStatus, { text: string; tone: BadgeTone }> = {
  open: { text: '청소사 모집 중', tone: 'warn' },
  matched: { text: '매칭 완료', tone: 'live' },
  in_progress: { text: '청소 중', tone: 'live' },
  done: { text: '완료', tone: 'default' },
};

export default function HostDashboard() {
  useStoreVersion();
  const jobs = getJobs();
  const props = getProperties();

  const open = jobs.filter((j) => j.status === 'open').length;
  const active = jobs.filter((j) => j.status === 'matched' || j.status === 'in_progress').length;
  const connected = props.filter((p) => p.connected).length;

  return (
    <Wrap>
      <AppNav />

      <Section title="호스트 대시보드" />
      <p className="hh-list-item__meta" style={{ marginTop: '-0.5rem' }}>
        지금은 <b>호스트 화면</b>이에요 — 청소 일감을 올리고, 수락한 청소사와 소통하는 쪽입니다.
      </p>

      <div className="hh-row" style={{ flexWrap: 'wrap', marginTop: '1rem' }}>
        <Stat label="모집 중" value={`${open}건`} />
        <Stat label="진행/예정" value={`${active}건`} />
        <Stat label="연결된 숙소" value={`${connected}곳`} />
      </div>

      <div className="hh-inline" style={{ marginTop: '1.25rem', flexWrap: 'wrap' }}>
        <Link href="/host/properties" style={{ flex: 1, minWidth: 180 }}>
          <Button block>숙소 · 캘린더 연결</Button>
        </Link>
        <Link href="/host/book" style={{ flex: 1, minWidth: 180 }}>
          <Button variant="ghost" block>직접 일감 등록</Button>
        </Link>
      </div>

      <div style={{ marginTop: '1.5rem' }}>
        <Section title="내 청소 일감" />
        <Card>
          {jobs.length === 0 ? (
            <div className="hh-list-item__meta" style={{ padding: '0.5rem 0' }}>
              아직 일감이 없습니다. 숙소 캘린더를 연결하면 체크아웃마다 자동 생성됩니다.
            </div>
          ) : (
            jobs.map((j) => (
              <ListItem
                key={j.id}
                left={
                  <>
                    <div>{j.property}</div>
                    <div className="hh-list-item__meta">
                      {j.district} · {j.time} · ₩{j.total.toLocaleString()}
                      {j.cleaner ? ` · ${j.cleaner}` : ''}
                      {j.source === 'calendar' ? ' · 캘린더' : ''}
                    </div>
                  </>
                }
                right={
                  <span className="hh-inline" style={{ alignItems: 'center' }}>
                    <Badge tone={LABEL[j.status].tone}>{LABEL[j.status].text}</Badge>
                    {j.cleaner ? (
                      <Link href={{ pathname: '/messages', query: { job: j.id, as: 'host' } }}>
                        <Button variant="ghost" style={{ minWidth: '5rem', padding: '0.5rem 0.9rem' }}>
                          메시지
                        </Button>
                      </Link>
                    ) : null}
                  </span>
                }
              />
            ))
          )}
        </Card>
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
