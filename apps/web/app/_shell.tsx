'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import type { Route } from 'next';

const CATS: { href: Route; label: string }[] = [
  { href: '/', label: '홈' },
  { href: '/host/properties', label: '숙소 연결' },
  { href: '/host', label: '호스트' },
  { href: '/cleaner', label: '일감 보드' },
  { href: '/messages', label: '메시지' },
  { href: '/live', label: '실시간' },
  { href: '/video', label: '영상 분석' },
];

function isActive(path: string, href: string): boolean {
  if (href === '/') return path === '/';
  if (href === '/host') return path === '/host' || path === '/host/book' || path === '/host/new';
  return path === href || path.startsWith(`${href}/`);
}

export function SiteHeader() {
  const router = useRouter();
  const path = usePathname();
  const [q, setQ] = useState('');

  return (
    <header className="site-header">
      <div className="site-util">
        <div className="site-util__in">
          <span>고객센터 1599-0000<span className="site-util__sep">·</span>평일 10:00 ~ 18:00</span>
          <span>
            <Link href="/login">로그인</Link>
            <span className="site-util__sep">|</span>
            <Link href="/host/new">회원가입</Link>
            <span className="site-util__sep">|</span>
            <Link href="/host">마이페이지</Link>
            <span className="site-util__sep">|</span>
            <a href="tel:1599-0000">고객센터</a>
          </span>
        </div>
      </div>

      <div className="site-header__in">
        <Link href="/" className="site-logo">
          <span className="site-logo__mark">H</span>
          호스트<b>헬퍼</b>
        </Link>

        <form
          className="site-search"
          onSubmit={(e) => {
            e.preventDefault();
            router.push('/cleaner');
          }}
        >
          <input
            placeholder="지역·숙소로 청소 일감 찾기"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            aria-label="검색"
          />
          <button type="submit" className="site-search__btn" aria-label="검색">
            <SearchIcon />
          </button>
        </form>

        <nav className="site-actions">
          <Link href="/host"><span className="ico"><HomeIcon /></span>호스트</Link>
          <Link href="/cleaner"><span className="ico"><BroomIcon /></span>청소사</Link>
          <Link href="/messages"><span className="ico"><ChatIcon /></span>메시지</Link>
        </nav>
      </div>

      <div className="site-cats">
        <div className="site-cats__in">
          {CATS.map((c) => (
            <Link key={c.href} href={c.href} className={isActive(path, c.href) ? 'is-active' : ''}>
              {c.label}
            </Link>
          ))}
        </div>
      </div>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="site-footer__in">
        <div>
          <div className="site-logo" style={{ fontSize: '1.1rem', marginBottom: '0.6rem' }}>
            <span className="site-logo__mark" style={{ width: '1.6rem', height: '1.6rem' }}>H</span>
            호스트<b>헬퍼</b>
          </div>
          <div>수익형 숙박 호스트와 청소 매니저를 잇는 양면 마켓플레이스.</div>
          <div style={{ marginTop: '0.6rem' }}>
            상호 호스트헬퍼 · 사업자등록번호 729-33-00827
            <br />
            고객센터 1599-0000 · 서울특별시
          </div>
          <div style={{ marginTop: '0.6rem' }}>© 2026 hosthelper</div>
        </div>
        <div>
          <h4>서비스</h4>
          <Link href="/host/properties">숙소 캘린더 연결</Link>
          <Link href="/host">호스트 대시보드</Link>
          <Link href="/cleaner">청소 일감 보드</Link>
          <Link href="/messages">메시지</Link>
        </div>
        <div>
          <h4>회사</h4>
          <a href="#">이용약관</a>
          <a href="#">개인정보처리방침</a>
          <a href="#">고객센터</a>
          <a href="#">공지사항</a>
        </div>
      </div>
    </footer>
  );
}

function SearchIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
      <circle cx="11" cy="11" r="7" />
      <line x1="21" y1="21" x2="16.7" y2="16.7" />
    </svg>
  );
}
function HomeIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 11l9-8 9 8" />
      <path d="M5 10v10h14V10" />
    </svg>
  );
}
function BroomIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M19 4l-9 9" />
      <path d="M11 8l5 5" />
      <path d="M10 13c-3 0-5 2-6 7 5-1 7-3 7-6z" />
    </svg>
  );
}
function ChatIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 12a8 8 0 0 1-11.5 7.2L4 20l1-4.5A8 8 0 1 1 21 12z" />
    </svg>
  );
}
