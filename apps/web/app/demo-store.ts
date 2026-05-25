'use client';

// 데모용 공용 "백엔드" (sessionStorage). 한 브라우저에서 호스트/청소사 양면을 모두 체험할 수 있도록
// 일감(Job) · 숙소(Property) · 메시지(Message)를 공유한다. 같은 탭/다른 탭 모두에서 갱신이 반영된다.

import { useEffect, useState } from 'react';

export type JobStatus = 'open' | 'matched' | 'in_progress' | 'done';
export type Role = 'host' | 'cleaner';

export interface Job {
  id: string;
  property: string;
  district: string;
  time: string;
  payout: number; // 청소사 정산액
  total: number; // 호스트 결제액(수수료 포함)
  status: JobStatus;
  cleaner?: string;
  source: 'calendar' | 'manual';
  createdAt: number;
}

export interface Property {
  id: string;
  name: string;
  district: string;
  source?: string; // 'Airbnb' | '직접' 등
  connected: boolean;
}

export interface Message {
  from: Role;
  text: string;
  at: number;
}

export const DEMO_CLEANER = '김민수 매니저';
export const PLATFORM_FEE = 10000;

const K_JOBS = 'hh_jobs';
const K_PROPS = 'hh_props';
const K_MSGS = 'hh_msgs';
const K_SEED = 'hh_seeded_v1';

function read<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback;
  try {
    const raw = sessionStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function write(key: string, value: unknown): void {
  if (typeof window === 'undefined') return;
  sessionStorage.setItem(key, JSON.stringify(value));
  window.dispatchEvent(new Event('hh-store'));
}

// ── Jobs ──────────────────────────────────────────────
export function getJobs(): Job[] {
  return read<Job[]>(K_JOBS, []).sort((a, b) => b.createdAt - a.createdAt);
}
export function addJob(job: Omit<Job, 'id' | 'createdAt'>): Job {
  const full: Job = { ...job, id: `j-${Date.now()}-${Math.floor(Math.random() * 1000)}`, createdAt: Date.now() };
  write(K_JOBS, [full, ...read<Job[]>(K_JOBS, [])]);
  return full;
}
export function updateJob(id: string, patch: Partial<Job>): void {
  write(
    K_JOBS,
    read<Job[]>(K_JOBS, []).map((j) => (j.id === id ? { ...j, ...patch } : j)),
  );
}
export function getJob(id: string | null): Job | undefined {
  if (!id) return undefined;
  return read<Job[]>(K_JOBS, []).find((j) => j.id === id);
}

// ── Properties ────────────────────────────────────────
export function getProperties(): Property[] {
  return read<Property[]>(K_PROPS, []);
}
export function addProperty(p: Omit<Property, 'id'>): Property {
  const full: Property = { ...p, id: `p-${Date.now()}` };
  write(K_PROPS, [...read<Property[]>(K_PROPS, []), full]);
  return full;
}
// 캘린더(체크아웃) 연결 → 다가오는 체크아웃 기준 청소 일감 자동 생성(데모)
export function connectCalendar(propertyId: string): Job[] {
  const props = read<Property[]>(K_PROPS, []);
  const prop = props.find((p) => p.id === propertyId);
  if (!prop) return [];
  write(
    K_PROPS,
    props.map((p) => (p.id === propertyId ? { ...p, connected: true, source: 'Airbnb' } : p)),
  );
  const slots = ['오늘 15:00', '내일 11:00', '모레 14:00'];
  const created: Job[] = slots.map((time, i) => {
    const payout = 55000 + i * 8000;
    return addJob({
      property: prop.name,
      district: prop.district,
      time,
      payout,
      total: payout + PLATFORM_FEE,
      status: 'open',
      source: 'calendar',
    });
  });
  return created;
}

// ── Messages ──────────────────────────────────────────
type MsgMap = Record<string, Message[]>;
export function getMessages(jobId: string | null): Message[] {
  if (!jobId) return [];
  return read<MsgMap>(K_MSGS, {})[jobId] ?? [];
}
export function addMessage(jobId: string, msg: Message): void {
  const map = read<MsgMap>(K_MSGS, {});
  const list = map[jobId] ?? [];
  write(K_MSGS, { ...map, [jobId]: [...list, msg] });
}

// ── Seed (최초 1회) ───────────────────────────────────
export function seedIfEmpty(): void {
  if (typeof window === 'undefined') return;
  if (sessionStorage.getItem(K_SEED)) return;
  sessionStorage.setItem(K_SEED, '1');

  const props: Property[] = [
    { id: 'p-seed-1', name: '청담 스카이뷰 #301', district: '강남구', source: 'Airbnb', connected: true },
    { id: 'p-seed-2', name: '한남 리버하우스', district: '용산구', source: 'Airbnb', connected: true },
    { id: 'p-seed-3', name: '연남 갤러리하우스', district: '마포구', connected: false },
  ];
  sessionStorage.setItem(K_PROPS, JSON.stringify(props));

  const now = Date.now();
  const jobs: Job[] = [
    { id: 'j-seed-1', property: '청담 스카이뷰 #301', district: '강남구', time: '오늘 14:00', payout: 65000, total: 75000, status: 'open', source: 'calendar', createdAt: now - 1000 },
    { id: 'j-seed-2', property: '역삼 코지스튜디오', district: '강남구', time: '오늘 18:00', payout: 55000, total: 65000, status: 'open', source: 'calendar', createdAt: now - 2000 },
    { id: 'j-seed-3', property: '한남 리버하우스', district: '용산구', time: '내일 11:00', payout: 78000, total: 88000, status: 'matched', cleaner: DEMO_CLEANER, source: 'manual', createdAt: now - 3000 },
  ];
  sessionStorage.setItem(K_JOBS, JSON.stringify(jobs));

  const msgs: MsgMap = {
    'j-seed-3': [
      { from: 'host', text: '안녕하세요! 체크아웃은 11시에 완료됩니다. 도어락 비밀번호는 도착하시면 알려드릴게요.', at: now - 60000 },
      { from: 'cleaner', text: '네 확인했습니다. 11시 조금 넘어 도착 예정이에요. 쓰레기 분리수거 위치만 미리 알려주실 수 있을까요?', at: now - 30000 },
    ],
  };
  sessionStorage.setItem(K_MSGS, JSON.stringify(msgs));
}

// ── 반응형 훅: 스토어 변경 시 리렌더 ──────────────────
export function useStoreVersion(): number {
  const [v, setV] = useState(0);
  useEffect(() => {
    seedIfEmpty();
    setV((x) => x + 1);
    const bump = () => setV((x) => x + 1);
    window.addEventListener('hh-store', bump);
    window.addEventListener('storage', bump);
    return () => {
      window.removeEventListener('hh-store', bump);
      window.removeEventListener('storage', bump);
    };
  }, []);
  return v;
}

export function formatTime(at: number): string {
  return new Date(at).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });
}
