// 데모용 화면 간 상태 저장소 (sessionStorage). 백엔드 없이 예약→대시보드 흐름을 잇는다.

export interface DemoBooking {
  id: string;
  property: string;
  time: string;
  total: number;
  status: 'matched' | 'requested';
  cleaner?: string;
}

const KEY = 'hh_demo_bookings';

export function getBookings(): DemoBooking[] {
  if (typeof window === 'undefined') return [];
  try {
    return JSON.parse(sessionStorage.getItem(KEY) ?? '[]') as DemoBooking[];
  } catch {
    return [];
  }
}

export function addBooking(booking: DemoBooking): void {
  if (typeof window === 'undefined') return;
  const list = [booking, ...getBookings()];
  sessionStorage.setItem(KEY, JSON.stringify(list));
}

const CLEANERS = ['박지은 매니저', '김서연 매니저', '이도윤 매니저', '최민준 매니저'];

export function randomCleaner(): string {
  return CLEANERS[Math.floor(Math.random() * CLEANERS.length)] as string;
}
