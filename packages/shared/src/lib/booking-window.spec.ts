import {
  BOOKING_WINDOW_DAYS,
  isoDate,
  bookingWindow,
  isSelectableDate,
  buildMonthGrid,
  canGoPrevMonth,
  canGoNextMonth,
  monthLabel,
  formatKoreanDate,
} from './booking-window';

// 고정 기준일: 2026-06-15 (월). 윈도우 = 2026-06-15 ~ 2026-07-15.
const TODAY = new Date(2026, 5, 15);

describe('bookingWindow', () => {
  it('오늘부터 30일', () => {
    const { min, max } = bookingWindow(TODAY);
    expect(isoDate(min)).toBe('2026-06-15');
    expect(isoDate(max)).toBe('2026-07-15');
    expect(BOOKING_WINDOW_DAYS).toBe(30);
  });
});

describe('isSelectableDate', () => {
  it('오늘은 선택 가능', () => {
    expect(isSelectableDate(new Date(2026, 5, 15), TODAY)).toBe(true);
  });
  it('어제는 불가(과거)', () => {
    expect(isSelectableDate(new Date(2026, 5, 14), TODAY)).toBe(false);
  });
  it('윈도우 마지막 날(+30일)은 가능', () => {
    expect(isSelectableDate(new Date(2026, 6, 15), TODAY)).toBe(true);
  });
  it('윈도우 다음 날(+31일)은 불가', () => {
    expect(isSelectableDate(new Date(2026, 6, 16), TODAY)).toBe(false);
  });
});

describe('buildMonthGrid', () => {
  it('42칸 고정', () => {
    expect(buildMonthGrid(2026, 5, TODAY)).toHaveLength(42);
  });
  it('6월 그리드는 일요일 시작 + 6/1은 월요일이라 앞에 5/31 한 칸', () => {
    const cells = buildMonthGrid(2026, 5, TODAY);
    expect(cells[0]?.iso).toBe('2026-05-31'); // 일요일
    expect(cells[0]?.inMonth).toBe(false);
    expect(cells[1]?.iso).toBe('2026-06-01');
    expect(cells[1]?.inMonth).toBe(true);
  });
  it('오늘 표시 + 과거/미래 선택 가능 여부', () => {
    const cells = buildMonthGrid(2026, 5, TODAY);
    const today = cells.find((c) => c.iso === '2026-06-15');
    expect(today?.isToday).toBe(true);
    expect(today?.selectable).toBe(true);
    expect(cells.find((c) => c.iso === '2026-06-10')?.selectable).toBe(false);
  });
});

describe('월 이동 가능 여부', () => {
  it('현재 달(6월)에서 이전 달 이동 불가', () => {
    expect(canGoPrevMonth(2026, 5, TODAY)).toBe(false);
  });
  it('현재 달(6월)에서 다음 달(7월) 이동 가능 — 윈도우가 7/15까지 걸침', () => {
    expect(canGoNextMonth(2026, 5, TODAY)).toBe(true);
  });
  it('7월에서 이전 달 이동 가능', () => {
    expect(canGoPrevMonth(2026, 6, TODAY)).toBe(true);
  });
  it('7월에서 다음 달(8월) 이동 불가 — 윈도우 밖', () => {
    expect(canGoNextMonth(2026, 6, TODAY)).toBe(false);
  });
});

describe('라벨', () => {
  it('monthLabel', () => {
    expect(monthLabel(2026, 5)).toBe('2026년 6월');
  });
  it('formatKoreanDate', () => {
    expect(formatKoreanDate('2026-06-15')).toBe('6월 15일 (월)');
  });
});
