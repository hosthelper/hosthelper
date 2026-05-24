import type { KpiSnapshot, PlatformEvent } from '@hosthelper/shared';

// 데모용 클라이언트 목업 스트림. 백엔드(SSE) 없이 /live 화면을 채운다.

const districts = ['강남구', '용산구', '마포구', '송파구', '성동구', '서초구'];
const properties = ['청담 스카이뷰', '한남 리버하우스', '연남 갤러리하우스', '잠실 레이크뷰', '성수 로프트'];
const surnames = ['김', '이', '박', '최', '정', '강'];
const prices = [55000, 65000, 72000, 88000, 95000];

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)] as T;
}
function rid(): string {
  return Math.random().toString(36).slice(2, 10);
}

let gmv = 1_840_000;
let activeJobs = 12;
let pendingOffers = 5;
let todayBookings = 23;

export function initialKpi(): KpiSnapshot {
  return {
    at: new Date().toISOString(),
    activeJobs,
    pendingOffers,
    todayBookings,
    todayGmv: gmv,
    openDisputes: 1,
  };
}

function nextKpi(): KpiSnapshot {
  activeJobs = Math.max(0, activeJobs + pick([-1, 0, 0, 1, 1]));
  pendingOffers = Math.max(0, pendingOffers + pick([-1, 0, 1]));
  return {
    at: new Date().toISOString(),
    activeJobs,
    pendingOffers,
    todayBookings,
    todayGmv: gmv,
    openDisputes: pick([0, 1, 1, 2]),
  };
}

const generators: Array<() => PlatformEvent> = [
  () => {
    const district = pick(districts);
    const property = pick(properties);
    const quotedPrice = pick(prices);
    todayBookings += 1;
    return {
      id: rid(),
      at: new Date().toISOString(),
      type: 'booking.created',
      title: `예약 생성 · ${district} ${property} (₩${quotedPrice.toLocaleString()})`,
      data: { bookingId: rid(), district, quotedPrice },
    };
  },
  () => {
    const amount = pick(prices);
    gmv += amount;
    return {
      id: rid(),
      at: new Date().toISOString(),
      type: 'payment.confirmed',
      title: `결제 확정 · ₩${amount.toLocaleString()}`,
      data: { bookingId: rid(), amount },
    };
  },
  () => {
    const candidateCount = pick([3, 4, 5, 6]);
    const topScore = Number((0.6 + Math.random() * 0.35).toFixed(4));
    return {
      id: rid(),
      at: new Date().toISOString(),
      type: 'match.candidates_computed',
      title: `후보 ${candidateCount}명 산출 · 최고점 ${topScore.toFixed(3)}`,
      data: { jobId: rid(), candidateCount, topScore },
    };
  },
  () => {
    const cleanerCount = pick([3, 4, 5]);
    const roundIdx = pick([1, 1, 2]);
    return {
      id: rid(),
      at: new Date().toISOString(),
      type: 'offer.created',
      title: `오퍼 발송 · 라운드 ${roundIdx} · ${cleanerCount}명`,
      data: {
        jobId: rid(),
        roundIdx,
        cleanerCount,
        expiresAt: new Date(Date.now() + 15 * 60_000).toISOString(),
      },
    };
  },
  () => ({
    id: rid(),
    at: new Date().toISOString(),
    type: 'offer.accepted',
    title: `오퍼 수락 · ${pick(surnames)}OO 매니저`,
    data: { jobId: rid(), cleanerId: rid() },
  }),
  () => ({
    id: rid(),
    at: new Date().toISOString(),
    type: 'job.matched',
    title: `매칭 완료 · ${pick(properties)}`,
    data: { jobId: rid(), cleanerId: rid() },
  }),
  () => ({
    id: rid(),
    at: new Date().toISOString(),
    type: 'offer.declined',
    title: '오퍼 거절 · 다음 라운드 진행',
    data: { jobId: rid(), cleanerId: rid() },
  }),
  () => ({
    id: rid(),
    at: new Date().toISOString(),
    type: 'dispute.triaged',
    title: `분쟁 1차 판정 · ${pick(['청소사 손', '호스트 손', '부분 환불', '사람 검토 필요'])}`,
    data: { jobId: rid(), recommendation: 'needs_human_review', confidence: Number((0.5 + Math.random() * 0.4).toFixed(2)) },
  }),
];

function makeEvent(): PlatformEvent {
  return pick(generators)();
}

export interface DemoHandlers {
  onSnapshot: (snapshot: KpiSnapshot) => void;
  onEvent: (event: PlatformEvent) => void;
}

// 스트림 시작. 정리 함수를 반환한다.
export function startDemoStream({ onSnapshot, onEvent }: DemoHandlers): () => void {
  onSnapshot(initialKpi());
  for (let i = 0; i < 5; i += 1) onEvent(makeEvent());

  const eventTimer = setInterval(() => onEvent(makeEvent()), 2500);
  const kpiTimer = setInterval(() => onSnapshot(nextKpi()), 5000);

  return () => {
    clearInterval(eventTimer);
    clearInterval(kpiTimer);
  };
}
