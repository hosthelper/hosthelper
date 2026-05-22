import type { Metadata, Viewport } from 'next';
import '@hosthelper/ui/styles.css';

export const metadata: Metadata = {
  title: 'hosthelper — 시간을 효율적으로 아껴드립니다',
  description: '수익형 숙박 운영자를 위한 청소 매니저 매칭·운영 SaaS',
  manifest: '/manifest.json',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#0a0a0a',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
