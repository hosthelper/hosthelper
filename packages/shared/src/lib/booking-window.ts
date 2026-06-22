// 예약 캘린더 순수 로직 — 페이지(월) 단위 표시 + "오늘부터 한 달(30일)" 롤링 예약 윈도우.
// 타임존은 로컬(서울 파일럿) 기준. UI/도메인 어디서나 재사용하도록 순수 함수로 작성.

export const BOOKING_WINDOW_DAYS = 30;
export const WEEKDAY_LABELS = ['일', '월', '화', '수', '목', '금', '토'] as const;

export interface CalendarDay {
  iso: string; // 'YYYY-MM-DD' (로컬)
  day: number; // 해당 월의 일(1~31)
  inMonth: boolean; // 현재 표시 중인 달에 속하는가
  isToday: boolean;
  selectable: boolean; // 예약 윈도우 안인가
}

export function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

export function isoDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function addDays(d: Date, n: number): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
}

// 윈도우 경계: [오늘 0시, 오늘+windowDays].
export function bookingWindow(
  today: Date,
  windowDays: number = BOOKING_WINDOW_DAYS,
): { min: Date; max: Date } {
  const min = startOfDay(today);
  return { min, max: addDays(min, windowDays) };
}

export function isSelectableDate(
  date: Date,
  today: Date,
  windowDays: number = BOOKING_WINDOW_DAYS,
): boolean {
  const { min, max } = bookingWindow(today, windowDays);
  const t = startOfDay(date).getTime();
  return t >= min.getTime() && t <= max.getTime();
}

function monthIndex(year: number, month0: number): number {
  return year * 12 + month0;
}

// 표시 중인 달의 6주(42칸) 그리드. 일요일 시작.
export function buildMonthGrid(
  viewYear: number,
  viewMonth: number, // 0-based
  today: Date,
  windowDays: number = BOOKING_WINDOW_DAYS,
): CalendarDay[] {
  const first = new Date(viewYear, viewMonth, 1);
  const gridStart = addDays(first, -first.getDay());
  const todayIso = isoDate(startOfDay(today));
  const cells: CalendarDay[] = [];
  for (let i = 0; i < 42; i++) {
    const d = addDays(gridStart, i);
    cells.push({
      iso: isoDate(d),
      day: d.getDate(),
      inMonth: d.getFullYear() === viewYear && d.getMonth() === viewMonth,
      isToday: isoDate(d) === todayIso,
      selectable: isSelectableDate(d, today, windowDays),
    });
  }
  return cells;
}

// 이전 달로 이동 가능? (윈도우 시작 달보다 뒤일 때만)
export function canGoPrevMonth(
  viewYear: number,
  viewMonth: number,
  today: Date,
  windowDays: number = BOOKING_WINDOW_DAYS,
): boolean {
  const { min } = bookingWindow(today, windowDays);
  return monthIndex(viewYear, viewMonth) > monthIndex(min.getFullYear(), min.getMonth());
}

// 다음 달로 이동 가능? (윈도우 끝 달보다 앞일 때만)
export function canGoNextMonth(
  viewYear: number,
  viewMonth: number,
  today: Date,
  windowDays: number = BOOKING_WINDOW_DAYS,
): boolean {
  const { max } = bookingWindow(today, windowDays);
  return monthIndex(viewYear, viewMonth) < monthIndex(max.getFullYear(), max.getMonth());
}

export function monthLabel(viewYear: number, viewMonth: number): string {
  return `${viewYear}년 ${viewMonth + 1}월`;
}

// 'YYYY-MM-DD' → 'M월 D일 (요일)'
export function formatKoreanDate(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  if (!y || !m || !d) return iso;
  const date = new Date(y, m - 1, d);
  return `${m}월 ${d}일 (${WEEKDAY_LABELS[date.getDay()]})`;
}
