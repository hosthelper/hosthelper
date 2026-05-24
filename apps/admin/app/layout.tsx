import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'hosthelper Admin',
};

const DEMO = process.env.NEXT_PUBLIC_DEMO === '1';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body style={{ fontFamily: 'system-ui, sans-serif', margin: 0 }}>
        {DEMO ? (
          <div
            style={{
              background: '#0a0a0a',
              color: '#fff',
              textAlign: 'center',
              fontSize: '0.8rem',
              padding: '0.45rem 1rem',
            }}
          >
            데모 모드 · 목업 데이터입니다 (실제 백엔드 미연결)
          </div>
        ) : null}
        <div style={{ padding: '2rem' }}>{children}</div>
      </body>
    </html>
  );
}
