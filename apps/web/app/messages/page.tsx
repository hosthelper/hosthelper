'use client';

import { Suspense, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Wrap, Section, Card, ListItem, Button, Badge, Footer } from '@hosthelper/ui';
import { AppNav } from '../nav';
import {
  getJobs,
  getJob,
  getMessages,
  addMessage,
  useStoreVersion,
  formatTime,
  type Role,
} from '../demo-store';

export default function MessagesPage() {
  return (
    <Suspense fallback={<Wrap><AppNav /><Section title="메시지" /></Wrap>}>
      <MessagesInner />
    </Suspense>
  );
}

function MessagesInner() {
  const params = useSearchParams();
  const jobId = params.get('job');
  const initialRole = (params.get('as') as Role) ?? 'host';
  return jobId ? <Thread jobId={jobId} initialRole={initialRole} /> : <ThreadList />;
}

function ThreadList() {
  useStoreVersion();
  const threads = getJobs().filter((j) => j.cleaner);

  return (
    <Wrap>
      <AppNav />
      <Section title="메시지" />
      <Card>
        {threads.length === 0 ? (
          <div className="hh-list-item__meta" style={{ padding: '0.5rem 0' }}>
            아직 대화가 없습니다. 청소사가 일감을 수락하면 대화가 열립니다.
          </div>
        ) : (
          threads.map((j) => (
            <Link key={j.id} href={{ pathname: '/messages', query: { job: j.id, as: 'host' } }}>
              <ListItem
                left={
                  <>
                    <div>{j.property}</div>
                    <div className="hh-list-item__meta">{j.cleaner} · {j.time}</div>
                  </>
                }
                right={<span>→</span>}
              />
            </Link>
          ))
        )}
      </Card>
      <Footer />
    </Wrap>
  );
}

function Thread({ jobId, initialRole }: { jobId: string; initialRole: Role }) {
  useStoreVersion();
  const [viewer, setViewer] = useState<Role>(initialRole);
  const [text, setText] = useState('');
  const job = getJob(jobId);
  const messages = getMessages(jobId);

  function send() {
    const t = text.trim();
    if (!t) return;
    addMessage(jobId, { from: viewer, text: t, at: Date.now() });
    setText('');
  }

  if (!job) {
    return (
      <Wrap>
        <AppNav />
        <Section title="메시지" />
        <Card>
          <div className="hh-list-item__meta">대화를 찾을 수 없습니다.</div>
          <div style={{ marginTop: '0.75rem' }}>
            <Link href="/messages"><Button variant="ghost">대화 목록</Button></Link>
          </div>
        </Card>
      </Wrap>
    );
  }

  const other = viewer === 'host' ? (job.cleaner ?? '청소사') : '호스트';

  return (
    <Wrap>
      <AppNav />

      <div style={{ paddingTop: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
        <div>
          <div style={{ fontSize: '1.2rem', fontWeight: 700 }}>{job.property}</div>
          <div className="hh-list-item__meta">{job.district} · {job.time} · {other}</div>
        </div>
        <span className="hh-inline" style={{ alignItems: 'center' }}>
          <Badge tone="default">{viewer === 'host' ? '호스트로 보는 중' : '청소사로 보는 중'}</Badge>
          <Button variant="ghost" style={{ minWidth: 0, padding: '0.4rem 0.8rem' }} onClick={() => setViewer(viewer === 'host' ? 'cleaner' : 'host')}>
            역할 전환
          </Button>
        </span>
      </div>

      <Card className="hh-msg-card">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', minHeight: 180 }}>
          {messages.length === 0 ? (
            <div className="hh-list-item__meta">첫 메시지를 보내보세요.</div>
          ) : (
            messages.map((m, i) => {
              const own = m.from === viewer;
              return (
                <div key={i} style={{ display: 'flex', justifyContent: own ? 'flex-end' : 'flex-start' }}>
                  <div
                    style={{
                      maxWidth: '78%',
                      padding: '0.55rem 0.8rem',
                      borderRadius: 12,
                      background: own ? '#0a0a0a' : '#f3f4f6',
                      color: own ? '#fff' : '#0a0a0a',
                    }}
                  >
                    <div style={{ fontSize: '0.92rem' }}>{m.text}</div>
                    <div style={{ fontSize: '0.7rem', opacity: 0.6, marginTop: '0.2rem', textAlign: 'right' }}>
                      {formatTime(m.at)}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </Card>

      <div className="hh-inline" style={{ marginTop: '0.75rem' }}>
        <input
          className="hh-field__input"
          style={{ flex: 1 }}
          placeholder={`${viewer === 'host' ? '청소사' : '호스트'}에게 메시지…`}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') send();
          }}
        />
        <Button onClick={send} disabled={!text.trim()} style={{ minWidth: '5rem' }}>
          보내기
        </Button>
      </div>

      <Footer />
    </Wrap>
  );
}
