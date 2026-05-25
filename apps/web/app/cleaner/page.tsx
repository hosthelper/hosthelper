'use client';

import { useState } from 'react';
import { Wrap, Section, Card, ListItem, Button, Badge, Footer } from '@hosthelper/ui';
import { AppNav } from '../nav';

interface Offer {
  id: string;
  property: string;
  district: string;
  time: string;
  payout: number;
  expiresInMin: number;
}

type JobStage = 'matched' | 'in_progress' | 'submitted';

interface AcceptedJob extends Offer {
  stage: JobStage;
}

const initialOffers: Offer[] = [
  { id: 'o-1', property: '청담 스카이뷰', district: '강남구', time: '오늘 14:00', payout: 65000, expiresInMin: 12 },
  { id: 'o-2', property: '한남 리버하우스', district: '용산구', time: '오늘 16:00', payout: 78000, expiresInMin: 7 },
  { id: 'o-3', property: '연남 갤러리하우스', district: '마포구', time: '내일 11:00', payout: 58000, expiresInMin: 25 },
];

const STAGE: Record<JobStage, { label: string; next?: JobStage; action?: string }> = {
  matched: { label: '예정', next: 'in_progress', action: '청소 시작' },
  in_progress: { label: '진행 중', next: 'submitted', action: '완료 제출' },
  submitted: { label: '완료 제출됨' },
};

export default function CleanerHome() {
  const [offers, setOffers] = useState<Offer[]>(initialOffers);
  const [jobs, setJobs] = useState<AcceptedJob[]>([]);

  function accept(o: Offer) {
    setOffers((prev) => prev.filter((x) => x.id !== o.id));
    setJobs((prev) => [{ ...o, stage: 'matched' }, ...prev]);
  }
  function decline(id: string) {
    setOffers((prev) => prev.filter((x) => x.id !== id));
  }
  function advance(id: string) {
    setJobs((prev) =>
      prev.map((j) => {
        if (j.id !== id) return j;
        const next = STAGE[j.stage].next;
        return next ? { ...j, stage: next } : j;
      }),
    );
  }

  return (
    <Wrap>
      <AppNav />

      <Section title="새 일감" />
      <Card>
        {offers.length === 0 ? (
          <div className="hh-list-item__meta" style={{ padding: '0.5rem 0' }}>
            대기 중인 일감이 없습니다. 새 일감이 들어오면 알림을 보내드립니다.
          </div>
        ) : (
          offers.map((o) => (
            <div key={o.id} style={{ padding: '1rem 0', borderBottom: '1px solid var(--hh-line)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <div>{o.property}</div>
                  <div className="hh-list-item__meta">
                    {o.district} · {o.time}
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontWeight: 700 }}>₩{o.payout.toLocaleString()}</div>
                  <div className="hh-list-item__meta">{o.expiresInMin}분 남음</div>
                </div>
              </div>
              <div className="hh-inline" style={{ marginTop: '0.75rem' }}>
                <Button variant="ghost" style={{ flex: 1 }} onClick={() => decline(o.id)}>
                  거절
                </Button>
                <Button style={{ flex: 1 }} onClick={() => accept(o)}>
                  수락
                </Button>
              </div>
            </div>
          ))
        )}
      </Card>

      <div style={{ marginTop: '1.5rem' }}>
        <Section title="내 일감" />
        <Card>
          {jobs.length === 0 ? (
            <div className="hh-list-item__meta" style={{ padding: '0.5rem 0' }}>
              수락한 일감이 여기에 표시됩니다.
            </div>
          ) : (
            jobs.map((j) => (
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
                  STAGE[j.stage].next ? (
                    <Button onClick={() => advance(j.id)} style={{ minWidth: '7rem' }}>
                      {STAGE[j.stage].action}
                    </Button>
                  ) : (
                    <Badge tone="live">{STAGE[j.stage].label}</Badge>
                  )
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
