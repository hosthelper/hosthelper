'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Shell, card, pill } from '../ui';

type CountMap = Record<string, number>;
type Channel = { platform: string; connected: boolean; username: string | null; token_expires_at: string | null; last_health_at: string | null; last_error: string | null; plan_status: CountMap };
type ContentItem = { content_id: string; title: string; format: string; qa_score: number; qa_status: string; status: string; auto_publish: boolean };
type Job = { id: string; content_id: string; job_type: string; status: string; provider: string | null; error: string | null };
type Plan = { id: string; content_id: string; platform: string; desired_media_type: string; status: string; last_reason: string | null };
type StatusData = {
  ok: boolean;
  generated_at: string;
  p0: {
    asset_generation: { total_jobs: number; job_status: CountMap; asset_status: CountMap; ready_assets: number };
    oauth: { connected: number; total: number };
    test_publish: { published_channels: number; total: number };
    external_post_ids: { verified_channels: number; total: number };
    campaign: any;
  };
  summary: { contents: number; qa_passed: number; assets: number; generation_jobs: CountMap; channel_plans: CountMap; posts: CountMap };
  campaign: any;
  kpi: any;
  channels: Channel[];
  contents: ContentItem[];
  jobs: Job[];
  plans: Plan[];
  posts: any[];
};

const STATUS_URL = 'https://qjtgueuaoohopffatjsp.supabase.co/functions/v1/content-ops-status';
const OAUTH_BASE = 'https://qjtgueuaoohopffatjsp.supabase.co/functions/v1/sns-oauth';
const platformLabel: Record<string, string> = { instagram: 'Instagram', threads: 'Threads', youtube: 'YouTube', tiktok: 'TikTok' };

const box = { ...card, borderRadius: 14 } as const;
const grid = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.75rem' } as const;
const small = { color: '#6b7280', fontSize: '0.78rem' } as const;

function statusPill(ok: boolean) {
  return <span style={{ ...pill, color: ok ? '#166534' : '#991b1b', background: ok ? '#f0fdf4' : '#fef2f2' }}>{ok ? '완료' : '대기'}</span>;
}

export default function ContentOpsPage() {
  const [data, setData] = useState<StatusData | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch(STATUS_URL, { cache: 'no-store' });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const body = (await r.json()) as StatusData;
      if (!body.ok) throw new Error('status api error');
      setData(body);
      setError('');
    } catch (e) {
      setError(String((e as Error)?.message || e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    const id = window.setInterval(() => void load(), 30000);
    return () => window.clearInterval(id);
  }, [load]);

  const blocker = useMemo(() => {
    if (!data) return '상태 확인 중';
    if (data.summary.assets === 0) return '카드뉴스·영상·나레이션 실제 Asset 생성';
    if (data.p0.oauth.connected < 4) return 'Instagram·Threads·YouTube·TikTok OAuth 연결';
    if (data.p0.test_publish.published_channels < 4) return '채널별 테스트 게시 1건';
    if (data.p0.external_post_ids.verified_channels < 4) return 'External Post ID 검증';
    return 'P0 Gate 통과 — 72시간 캠페인 시작 가능';
  }, [data]);

  return (
    <Shell
      title="헬퍼오피스 · 콘텐츠 운영실"
      actions={<button onClick={() => void load()} disabled={loading} style={{ padding: '0.5rem 0.8rem', borderRadius: 8, border: '1px solid #e5e7eb', background: '#fff', cursor: 'pointer' }}>{loading ? '동기화 중…' : '새로고침'}</button>}
    >
      {error ? <div style={{ ...box, borderColor: '#fecaca', background: '#fef2f2', color: '#991b1b' }}>실데이터 연결 오류: {error}</div> : null}
      {!data ? <div style={box}>{loading ? 'Content Autopilot 상태를 불러오는 중입니다…' : '데이터가 없습니다.'}</div> : null}

      {data ? <>
        <section style={{ ...box, marginBottom: '1rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
            <div>
              <div style={{ color: '#4f46e5', fontWeight: 800, fontSize: '0.75rem', letterSpacing: '.08em' }}>P0 RELEASE GATE</div>
              <h2 style={{ margin: '0.35rem 0 0.2rem', fontSize: '1.15rem' }}>자동 제작 → SNS 게시 → 캠페인 시작</h2>
              <div style={small}>현재 최우선 병목: <strong style={{ color: '#111827' }}>{blocker}</strong></div>
            </div>
            <span style={{ ...pill, background: blocker.startsWith('P0 Gate') ? '#ecfdf5' : '#fff7ed', color: blocker.startsWith('P0 Gate') ? '#047857' : '#c2410c' }}>{blocker.startsWith('P0 Gate') ? 'START 가능' : '진행 중'}</span>
          </div>

          <div style={{ ...grid, marginTop: '1rem' }}>
            {[
              ['① Asset 생성', data.p0.asset_generation.ready_assets, Math.max(data.p0.asset_generation.total_jobs, 1)],
              ['② SNS OAuth', data.p0.oauth.connected, data.p0.oauth.total],
              ['③ 테스트 게시', data.p0.test_publish.published_channels, data.p0.test_publish.total],
              ['④ External ID', data.p0.external_post_ids.verified_channels, data.p0.external_post_ids.total],
              ['⑤ 72h Campaign', data.campaign?.status === 'active' ? 1 : 0, 1],
            ].map(([label, value, max]) => {
              const v = Number(value);
              const m = Number(max);
              const pct = Math.min(100, Math.round((v / m) * 100));
              return <div key={String(label)} style={{ border: '1px solid #eef0f3', borderRadius: 12, padding: '0.9rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 6 }}><strong>{label}</strong>{statusPill(v >= m)}</div>
                <div style={{ fontSize: '1.25rem', fontWeight: 800, marginTop: '0.5rem' }}>{v} / {m}</div>
                <div style={{ height: 6, borderRadius: 99, background: '#eef2ff', overflow: 'hidden', marginTop: '0.45rem' }}><div style={{ width: `${pct}%`, height: '100%', background: '#4f46e5' }} /></div>
              </div>;
            })}
          </div>
        </section>

        <section style={{ ...grid, marginBottom: '1rem' }}>
          <div style={box}><div style={small}>콘텐츠</div><div style={{ fontSize: '1.55rem', fontWeight: 800 }}>{data.summary.contents}</div><div style={small}>QA PASS {data.summary.qa_passed}</div></div>
          <div style={box}><div style={small}>Ready Assets</div><div style={{ fontSize: '1.55rem', fontWeight: 800 }}>{data.p0.asset_generation.ready_assets}</div><div style={small}>생성 Job {data.p0.asset_generation.total_jobs}</div></div>
          <div style={box}><div style={small}>SNS 연결</div><div style={{ fontSize: '1.55rem', fontWeight: 800 }}>{data.p0.oauth.connected}/4</div><div style={small}>OAuth</div></div>
          <div style={box}><div style={small}>무료진단 신청</div><div style={{ fontSize: '1.55rem', fontWeight: 800 }}>{data.kpi?.diagnosis_applied ?? 0}/{data.campaign?.goal_customers ?? 10}</div><div style={small}>달성률 {Number(data.kpi?.achievement_pct ?? 0).toFixed(0)}%</div></div>
        </section>

        <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1rem', marginBottom: '1rem' }}>
          <div style={box}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}><h2 style={{ fontSize: '1rem', margin: 0 }}>SNS 연결센터</h2><a href={OAUTH_BASE} target="_blank" rel="noreferrer" style={{ color: '#4f46e5', fontSize: '0.8rem' }}>전체 연결</a></div>
            <div style={{ display: 'grid', gap: '0.55rem', marginTop: '0.8rem' }}>
              {data.channels.map((c) => <div key={c.platform} style={{ border: '1px solid #eef0f3', borderRadius: 10, padding: '0.75rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><strong style={{ flex: 1 }}>{platformLabel[c.platform] || c.platform}</strong>{statusPill(c.connected)}</div>
                <div style={{ ...small, marginTop: 4 }}>{c.connected ? (c.username || '연결됨') : Object.entries(c.plan_status).map(([k, v]) => `${k} ${v}`).join(' · ') || '연결 필요'}</div>
                {!c.connected ? <a href={`${OAUTH_BASE}/${c.platform}/start`} target="_blank" rel="noreferrer" style={{ display: 'inline-block', marginTop: 8, fontSize: '0.8rem', color: '#4f46e5' }}>계정 연결 →</a> : null}
              </div>)}
            </div>
          </div>

          <div style={box}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center' }}><h2 style={{ fontSize: '1rem', margin: 0 }}>{data.campaign?.name || '캠페인'}</h2><span style={pill}>{String(data.campaign?.status || 'none').toUpperCase()}</span></div>
            <div style={{ ...small, marginTop: 6 }}>{data.campaign?.starts_at ? '72시간 타이머 실행 중' : '첫 실제 게시 성공 전 — 타이머 미시작'}</div>
            <div style={{ ...grid, marginTop: '0.8rem', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' }}>
              {[
                ['DM 진단', data.kpi?.dm_diagnosis ?? 0],
                ['숙소 링크', data.kpi?.property_link_sent ?? 0],
                ['무료진단 신청', data.kpi?.diagnosis_applied ?? 0],
                ['진단 완료', data.kpi?.diagnosis_completed ?? 0],
                ['상담 전환', data.kpi?.consultation_converted ?? 0],
              ].map(([label, value]) => <div key={String(label)} style={{ border: '1px solid #eef0f3', borderRadius: 10, padding: '0.7rem' }}><div style={small}>{label}</div><strong style={{ fontSize: '1.2rem' }}>{value}</strong></div>)}
            </div>
          </div>
        </section>

        <section style={{ ...box, marginBottom: '1rem' }}>
          <h2 style={{ fontSize: '1rem', marginTop: 0 }}>콘텐츠 제작 진행</h2>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 820 }}>
              <thead><tr>{['콘텐츠', '포맷', 'QA', '생성 Job', '게시 병목', '자동게시'].map((h) => <th key={h} style={{ textAlign: 'left', fontSize: '0.75rem', color: '#6b7280', padding: '0.55rem', borderBottom: '1px solid #e5e7eb' }}>{h}</th>)}</tr></thead>
              <tbody>{data.contents.map((c) => {
                const jobs = data.jobs.filter((j) => j.content_id === c.content_id);
                const plans = data.plans.filter((p) => p.content_id === c.content_id);
                const reasons = Array.from(new Set(plans.map((p) => p.last_reason).filter(Boolean)));
                return <tr key={c.content_id}>
                  <td style={{ padding: '0.7rem 0.55rem', borderBottom: '1px solid #f3f4f6' }}><strong>{c.title}</strong><div style={small}>{c.content_id}</div></td>
                  <td style={{ padding: '0.7rem 0.55rem', borderBottom: '1px solid #f3f4f6' }}>{c.format}</td>
                  <td style={{ padding: '0.7rem 0.55rem', borderBottom: '1px solid #f3f4f6' }}>{c.qa_score}점</td>
                  <td style={{ padding: '0.7rem 0.55rem', borderBottom: '1px solid #f3f4f6' }}>{jobs.map((j) => <div key={j.id} style={small}>{j.job_type} · {j.status}</div>)}</td>
                  <td style={{ padding: '0.7rem 0.55rem', borderBottom: '1px solid #f3f4f6', color: reasons.length ? '#b45309' : '#166534' }}>{reasons.length ? reasons.join(' / ') : 'READY'}</td>
                  <td style={{ padding: '0.7rem 0.55rem', borderBottom: '1px solid #f3f4f6' }}>{c.auto_publish ? 'ON' : 'OFF'}</td>
                </tr>;
              })}</tbody>
            </table>
          </div>
        </section>

        <section style={{ ...box, marginBottom: '1rem' }}>
          <h2 style={{ fontSize: '1rem', marginTop: 0 }}>실제 게시 Evidence</h2>
          {data.posts.length === 0 ? <div style={{ ...small, padding: '1rem 0' }}>아직 실제 게시 Evidence가 없습니다. OAuth → 테스트 게시 → External Post ID가 확인되면 이곳에 표시됩니다.</div> : data.posts.map((p) => <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 8, borderTop: '1px solid #f3f4f6', padding: '0.7rem 0' }}><span>{platformLabel[p.platform] || p.platform} · {p.title || p.content_id}</span><span style={small}>{p.external_id || p.last_error_code || p.status}</span></div>)}
        </section>

        <div style={{ ...small, textAlign: 'right' }}>실데이터 자동 새로고침 30초 · API snapshot {new Date(data.generated_at).toLocaleString('ko-KR')}</div>
      </> : null}
    </Shell>
  );
}
