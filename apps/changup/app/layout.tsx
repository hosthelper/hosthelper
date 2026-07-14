import type { Metadata, Viewport } from 'next';

export const metadata: Metadata = {
  title: '창업이지 — 점포 매물 매칭',
  description: '원하는 조건의 창업 매물을 찾아드립니다. 설문을 남기면 담당자가 연락드립니다.',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body style={{ fontFamily: 'system-ui, sans-serif', margin: 0, background: '#fafafa' }}>
        {children}
      </body>
    </html>
  );
}
