import Link from 'next/link';

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

const labels: Record<Job['status'], { text: string; cls: string }> = {
  matched: { text: '매칭 완료', cls: 'live' },
  requested: { text: '매칭 중', cls: 'warn' },
  in_progress: { text: '진행 중', cls: 'live' },
  done: { text: '완료', cls: '' },
};

export default function HostDashboard() {
  return (
    <div className="wrap">
      <nav className="nav">
        <span className="logo">hosthelper</span>
        <Link href="/login" className="login">로그아웃</Link>
      </nav>

      <section style={{ padding: '2.5rem 0 1rem' }}>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 700 }}>오늘 일정</h1>
      </section>

      <div className="card">
        {stubJobs.map((j) => (
          <div key={j.id} className="list-item">
            <div>
              <div>{j.property}</div>
              <div className="meta">
                {j.time} {j.cleaner ? `· ${j.cleaner}` : ''}
              </div>
            </div>
            <span className={`badge ${labels[j.status].cls}`}>{labels[j.status].text}</span>
          </div>
        ))}
      </div>

      <div style={{ marginTop: '1.25rem' }}>
        <Link href="/host/book" className="btn primary block">
          청소 예약하기
        </Link>
      </div>

      <footer className="foot">© hosthelper</footer>
    </div>
  );
}
