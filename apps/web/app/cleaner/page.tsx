'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Wrap, Section, Card, ListItem, Button, Badge, Footer } from '@hosthelper/ui';
import { AppNav } from '../nav';
import {
  getJobs,
  updateJob,
  useStoreVersion,
  DEMO_CLEANER,
  type Job,
  type JobStatus,
} from '../demo-store';

const NEXT: Partial<Record<JobStatus, { to: JobStatus; action: string }>> = {
  matched: { to: 'in_progress', action: '청소 시작' },
  in_progress: { to: 'done', action: '완료 제출' },
};

export default function CleanerHome() {
  useStoreVersion();
  const [hidden, setHidden] = useState<string[]>([]);
  const jobs = getJobs();
  const open = jobs.filter((j) => j.status === 'open' && !hidden.includes(j.id));
  const mine = jobs.filter((j) => j.cleaner === DEMO_CLEANER && j.status !== 'open');

  function accept(j: Job) {
    updateJob(j.id, { status: 'matched', cleaner: DEMO_CLEANER });
  }
  function decline(id: string) {
    setHidden((prev) => [...prev, id]);
  }
  function advance(j: Job) {
    const step = NEXT[j.status];
    if (step) updateJob(j.id, { status: step.to });
  }

  return (
    <Wrap>
      <AppNav />

      <Section title="청소 일감 보드" />
      <p className="hh-list-item__meta" style={{ marginTop: '-0.5rem' }}>
        호스트가 등록한 청소 일감입니다. 수락하면 호스트와 메시지를 주고받을 수 있습니다.
      </p>

      <div style={{ marginTop: '1rem' }}>
        <Card>
          {open.length === 0 ? (
            <div className="hh-list-item__meta" style={{ padding: '0.5rem 0' }}>
              지금 모집 중인 일감이 없습니다. 새 일감이 등록되면 여기에 표시됩니다.
            </div>
          ) : (
            open.map((j) => (
              <div key={j.id} style={{ padding: '1rem 0', borderBottom: '1px solid var(--hh-line)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <div>{j.property}</div>
                    <div className="hh-list-item__meta">
                      {j.district} · {j.time}
                      {j.source === 'calendar' ? ' · 캘린더 자동' : ''}
                    </div>
                  </div>
                  <div style={{ fontWeight: 700 }}>₩{j.payout.toLocaleString()}</div>
                </div>
                <div className="hh-inline" style={{ marginTop: '0.75rem' }}>
                  <Button variant="ghost" style={{ flex: 1 }} onClick={() => decline(j.id)}>
                    거절
                  </Button>
                  <Button style={{ flex: 1 }} onClick={() => accept(j)}>
                    수락
                  </Button>
                </div>
              </div>
            ))
          )}
        </Card>
      </div>

      <div style={{ marginTop: '1.5rem' }}>
        <Section title="내 일감" />
        <Card>
          {mine.length === 0 ? (
            <div className="hh-list-item__meta" style={{ padding: '0.5rem 0' }}>
              수락한 일감이 여기에 표시됩니다.
            </div>
          ) : (
            mine.map((j) => (
              <ListItem
                key={j.id}
                left={
                  <>
                    <div>{j.property}</div>
                    <div className="hh-list-item__meta">
                      {j.district} · {j.time} · ₩{j.payout.toLocaleString()}
                    </div>
                  </>
                }
                right={
                  <span className="hh-inline" style={{ alignItems: 'center' }}>
                    <Link href={{ pathname: '/messages', query: { job: j.id, as: 'cleaner' } }}>
                      <Button variant="ghost" style={{ minWidth: '5rem', padding: '0.5rem 0.9rem' }}>
                        메시지
                      </Button>
                    </Link>
                    {NEXT[j.status] ? (
                      <Button onClick={() => advance(j)} style={{ minWidth: '6rem', padding: '0.5rem 0.9rem' }}>
                        {NEXT[j.status]!.action}
                      </Button>
                    ) : (
                      <Badge tone="default">완료</Badge>
                    )}
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
