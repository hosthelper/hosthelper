import type { Metadata, Viewport } from 'next';

// 대외(설문 링크 공유) 타이틀은 진입장벽을 낮춘 "창업정보 모임"을 사용한다.
export const metadata: Metadata = {
  title: '창업정보 모임 — 창업 매물 설문',
  description:
    '원하는 조건의 창업 매물을 찾아드립니다. 설문을 남기면 1~2일 내 순차적으로 연락드립니다.',
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
