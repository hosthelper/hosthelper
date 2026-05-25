import Link from 'next/link';
import { Nav } from '@hosthelper/ui';

// 인증 영역 공통 상단 내비 — 역할 화면 사이를 끊김 없이 이동.
export function AppNav() {
  return (
    <Nav
      logo={<Link href="/">hosthelper</Link>}
      right={
        <span className="hh-inline" style={{ gap: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
          <Link href="/host">호스트</Link>
          <Link href="/cleaner">청소사</Link>
          <Link href="/messages">메시지</Link>
          <Link href="/live">실시간</Link>
        </span>
      }
    />
  );
}
